import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { promisify } from 'util';

const randomBytesAsync = promisify(randomBytes);

/** Catégories par défaut créées automatiquement à l'inscription de chaque tenant. */
const DEFAULT_MENU_CATEGORIES = [
  { name: 'ENTREE', displayOrder: 1 },
  { name: 'MAIN', displayOrder: 2 },
  { name: 'DESSERT', displayOrder: 3 },
  { name: 'DRINK', displayOrder: 4 },
  { name: 'SIDE', displayOrder: 5 },
] as const;

interface TokenPayload {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

interface AuthResponse extends TokenPayload {
  user: UserResponse;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly DUMMY_HASH = '$2b$12$clZ8Wf9XUbHshWsnK6pM/.Vp0YhIWhbOOmO7Z6yREshH8g7D43W9q';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('error.auth.email.already_exists');
    }

    const saltRounds = parseInt(this.config.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10);
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const slug = await this.generateUniqueSlug(dto.restaurantName);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = await this.prisma.$transaction(async (tx: any) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.restaurantName,
            slug: slug,
            email: dto.email,
          },
        });

        // Seed des catégories de menu par défaut pour ce tenant
        await tx.menuCategory.createMany({
          data: DEFAULT_MENU_CATEGORIES.map((cat) => ({
            ...cat,
            tenantId: tenant.id,
          })),
        });

        return tx.user.create({
          data: {
            email: dto.email,
            hashedPassword: hashedPassword,
            name: dto.name,
            role: 'OWNER',
            tenantId: tenant.id,
          },
        });
      });

      const tokens = await this.generateTokens(user.id, user.tenantId, user.role);
      const userData = await this.fetchUserForResponse(user.id);
      return { ...tokens, user: userData };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('error.auth.signup_failed.conflict');
      }
      this.logger.error(`Signup failed for email ${dto.email}:`, (error as Error).stack);
      throw new InternalServerErrorException('error.auth.signup_failed');
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: { id: true, tenantId: true, role: true, hashedPassword: true },
    });

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user ? user.hashedPassword : this.DUMMY_HASH,
    );

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('error.auth.invalid_credentials');
    }

    const tokens = await this.generateTokens(user.id, user.tenantId, user.role);
    const userData = await this.fetchUserForResponse(user.id);
    return { ...tokens, user: userData };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        user: { select: { id: true, tenantId: true, role: true } },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        this.prisma.refreshToken
          .delete({ where: { id: stored.id } })
          .catch((err: Error) =>
            this.logger.error(`Failed to delete expired token: ${err.message}`),
          );
      }
      throw new UnauthorizedException('error.auth.refresh_token.invalid');
    }

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.tenantId,
      stored.user.role,
    );
    const userData = await this.fetchUserForResponse(stored.user.id);
    return { ...tokens, user: userData };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    try {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
    } catch (error: unknown) {
      this.logger.warn(`Logout token deletion skipped or failed: ${(error as Error).message}`);
    }
  }

  async me(userId: string) {
    return this.fetchUserForResponse(userId);
  }

  /** Returns a serializable user object that includes the tenant name. */
  private async fetchUserForResponse(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        tenant: { select: { name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('error.auth.user.not_found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as string,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    };
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    role: string,
  ): Promise<TokenPayload> {
    await this.prisma.refreshToken.deleteMany({
      where: {
        userId: userId,
        expiresAt: { lt: new Date() },
      },
    });

    const payload = { sub: userId, tenantId, role };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const buffer = await randomBytesAsync(32);
    const rawToken = buffer.toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        tenantId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawToken };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const buffer = await randomBytesAsync(4);
    const randomSuffix = buffer.toString('hex');
    return `${baseSlug}-${randomSuffix}`;
  }
}
