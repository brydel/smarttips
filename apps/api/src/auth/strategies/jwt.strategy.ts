import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  tenantId: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Le "?? 'fallback...'" garantit à TypeScript qu'il y aura TOUJOURS une string passée à Passport
      secretOrKey:
        config.get<string>('JWT_SECRET') ?? 'super-fallback-secret-key-only-for-local-dev',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.tenantId || !payload.role) {
      throw new UnauthorizedException('error.auth.invalid_token_structure');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}
