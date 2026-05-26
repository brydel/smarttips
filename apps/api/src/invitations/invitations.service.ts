import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmployeeInvitationStatus, Prisma, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptEmployeeInvitationDto } from './dto/accept-employee-invitation.dto';
import { CreateEmployeeInvitationDto } from './dto/create-employee-invitation.dto';

type InvitationCreateResponse = {
  id: string;
  email: string;
  expiresAt: Date;
  inviteUrl: string;
};

type InvitationValidationResponse = {
  valid: true;
  email: string;
  expiresAt: Date;
  employee: {
    firstName: string;
    lastName: string;
    role: string;
  };
  tenant: {
    name: string;
  };
};

type InvitationAcceptResponse = {
  accessToken: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    name: string;
  };
};

@Injectable()
export class InvitationsService {
  private readonly tokenBytes = 32;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async create(
    tenantId: string,
    invitedBy: string,
    dto: CreateEmployeeInvitationDto,
  ): Promise<InvitationCreateResponse> {
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.buildExpirationDate();
    const inviteUrl = this.buildInviteUrl(rawToken);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: dto.employeeId,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          active: true,
          userId: true,
          tenant: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('error.invitation.employeeNotFound');
      }

      if (!employee.active) {
        throw new BadRequestException('error.invitation.employeeInactive');
      }

      if (employee.userId) {
        throw new ConflictException('error.invitation.employeeAlreadyHasUser');
      }

      const inviter = await tx.user.findFirst({
        where: {
          id: invitedBy,
          tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!inviter) {
        throw new NotFoundException('error.invitation.inviterNotFound');
      }

      const existingUser = await tx.user.findFirst({
        where: {
          tenantId,
          email: dto.email,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new ConflictException('error.invitation.emailAlreadyUsed');
      }

      await tx.employeeInvitation.updateMany({
        where: {
          tenantId,
          employeeId: dto.employeeId,
          status: EmployeeInvitationStatus.PENDING,
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: EmployeeInvitationStatus.EXPIRED,
        },
      });

      const existingPending = await tx.employeeInvitation.findFirst({
        where: {
          tenantId,
          employeeId: dto.employeeId,
          status: EmployeeInvitationStatus.PENDING,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (existingPending) {
        throw new ConflictException('error.invitation.alreadyPending');
      }

      return tx.employeeInvitation.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          email: dto.email,
          tokenHash,
          expiresAt,
          invitedBy,
          status: EmployeeInvitationStatus.PENDING,
        },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          tenant: {
            select: {
              name: true,
            },
          },
          inviter: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    try {
      await this.email.sendInvitationEmail(
        invitation.email,
        invitation.tenant.name,
        invitation.inviter.name,
        inviteUrl,
      );
    } catch {
      await this.prisma.employeeInvitation.updateMany({
        where: {
          id: invitation.id,
          status: EmployeeInvitationStatus.PENDING,
        },
        data: {
          status: EmployeeInvitationStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      throw new ServiceUnavailableException('error.email.sendFailed');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      inviteUrl,
    };
  }

  async validate(token: string): Promise<InvitationValidationResponse> {
    const tokenHash = this.hashIncomingToken(token);

    const invitation = await this.prisma.employeeInvitation.findUnique({
      where: {
        tokenHash,
      },
      select: {
        email: true,
        status: true,
        expiresAt: true,
        tenant: {
          select: {
            name: true,
          },
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
            active: true,
            deletedAt: true,
            userId: true,
          },
        },
      },
    });

    if (!invitation || invitation.status !== EmployeeInvitationStatus.PENDING) {
      throw new NotFoundException('error.invitation.invalidToken');
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.employeeInvitation.updateMany({
        where: {
          tokenHash,
          status: EmployeeInvitationStatus.PENDING,
        },
        data: {
          status: EmployeeInvitationStatus.EXPIRED,
        },
      });

      throw new UnprocessableEntityException('error.invitation.expired');
    }

    if (
      !invitation.employee.active ||
      invitation.employee.deletedAt ||
      invitation.employee.userId
    ) {
      throw new UnprocessableEntityException('error.invitation.employeeNotEligible');
    }

    return {
      valid: true,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      employee: {
        firstName: invitation.employee.firstName,
        lastName: invitation.employee.lastName,
        role: invitation.employee.role,
      },
      tenant: {
        name: invitation.tenant.name,
      },
    };
  }

  async accept(token: string, dto: AcceptEmployeeInvitationDto): Promise<InvitationAcceptResponse> {
    const tokenHash = this.hashIncomingToken(token);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.employeeInvitation.findUnique({
        where: {
          tokenHash,
        },
        select: {
          id: true,
          tenantId: true,
          employeeId: true,
          email: true,
          status: true,
          expiresAt: true,
          employee: {
            select: {
              id: true,
              active: true,
              deletedAt: true,
              userId: true,
            },
          },
        },
      });

      if (!invitation || invitation.status !== EmployeeInvitationStatus.PENDING) {
        throw new NotFoundException('error.invitation.invalidToken');
      }

      if (invitation.expiresAt < now) {
        await tx.employeeInvitation.updateMany({
          where: {
            id: invitation.id,
            status: EmployeeInvitationStatus.PENDING,
          },
          data: {
            status: EmployeeInvitationStatus.EXPIRED,
          },
        });

        throw new UnprocessableEntityException('error.invitation.expired');
      }

      if (
        !invitation.employee.active ||
        invitation.employee.deletedAt ||
        invitation.employee.userId
      ) {
        throw new UnprocessableEntityException('error.invitation.employeeNotEligible');
      }

      const existingUser = await tx.user.findFirst({
        where: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (existingUser) {
        throw new ConflictException('error.invitation.emailAlreadyUsed');
      }

      const claimResult = await tx.employeeInvitation.updateMany({
        where: {
          id: invitation.id,
          status: EmployeeInvitationStatus.PENDING,
          acceptedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          status: EmployeeInvitationStatus.ACCEPTED,
          acceptedAt: now,
        },
      });

      if (claimResult.count !== 1) {
        throw new ConflictException('error.invitation.alreadyAccepted');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 12);
      const name = `${dto.firstName} ${dto.lastName}`.trim();

      const user = await tx.user.create({
        data: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          hashedPassword,
          role: UserRole.EMPLOYEE,
          name,
          emailVerified: true,
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          role: true,
          name: true,
        },
      });

      await tx.employee.update({
        where: {
          id: invitation.employeeId,
        },
        data: {
          userId: user.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: invitation.email,
        },
      });

      await tx.employeeInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          acceptedBy: user.id,
        },
      });

      const accessToken = await this.signAccessToken(user);

      return {
        accessToken,
        user,
      };
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.employeeInvitation.findMany({
      where: {
        tenantId,
      },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async revoke(tenantId: string, id: string): Promise<void> {
    const invitation = await this.prisma.employeeInvitation.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('error.invitation.notFound');
    }

    if (invitation.status !== EmployeeInvitationStatus.PENDING) {
      throw new ConflictException('error.invitation.notRevokable');
    }

    const updateResult = await this.prisma.employeeInvitation.updateMany({
      where: {
        id,
        tenantId,
        status: EmployeeInvitationStatus.PENDING,
      },
      data: {
        status: EmployeeInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException('error.invitation.concurrentRevoke');
    }
  }

  private async signAccessToken(user: {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    name: string;
  }): Promise<string> {
    return this.jwt.signAsync({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }

  private generateRawToken(): string {
    return randomBytes(this.tokenBytes).toString('hex');
  }

  private hashIncomingToken(token: string): string {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      throw new NotFoundException('error.invitation.invalidToken');
    }

    return this.hashToken(token);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildExpirationDate(): Date {
    const ttlDays = this.config.get<number>('INVITATION_TTL_DAYS', 7);
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    return expiresAt;
  }

  private buildInviteUrl(rawToken: string): string {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? this.config.get<string>('APP_URL');

    if (!frontendUrl) {
      throw new BadRequestException('error.config.frontendUrlMissing');
    }

    const url = new URL('/invite', frontendUrl);
    url.searchParams.set('token', rawToken);

    return url.toString();
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
