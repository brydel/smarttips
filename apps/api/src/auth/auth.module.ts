import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // Enregistrement de Passport avec la stratégie JWT par défaut
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Configuration asynchrone et sécurisée du JWT
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // On type explicitement le retour de la fonction pour valider l'objet avec NestJS
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');

        // Récupération sécurisée : on dit à NestJS que la valeur attendue respecte le type requis
        const expiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');

        // Sécurité critique : Crash immédiat au démarrage quelle que soit l'env
        // NEVER use a fallback — a missing secret is always a fatal misconfiguration.
        if (!secret) {
          throw new Error(
            'FATAL: JWT_SECRET is not defined. The application cannot start without it.',
          );
        }

        return {
          secret,
          signOptions: {
            // On utilise un petit cast "unknown" vers le type attendu pour satisfaire le compilateur
            expiresIn: expiresIn as unknown as number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [
    AuthService,
    JwtModule,
    PassportModule, // Crucial pour que tes guards fonctionnent dans les autres modules
  ],
})
export class AuthModule {}
