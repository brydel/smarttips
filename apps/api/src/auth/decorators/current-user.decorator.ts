import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

// On permet à data d'être une clé de notre interface AuthenticatedUser
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // 1. BLINDAGE : Si le développeur a oublié le JwtAuthGuard sur la route
    if (!user) {
      // En mode développement, on veut un message ultra-clair pour corriger le tir instantanément
      if (process.env.NODE_ENV !== 'production') {
        throw new InternalServerErrorException(
          '@CurrentUser decorator was used on a route without JwtAuthGuard. Please check your controller configuration.',
        );
      }
      // En production, on retourne null pour éviter un crash 500 et laisser le code gérer proprement
      return null;
    }

    // 2. FLEXIBILITÉ : Si on a demandé une propriété précise (ex: @CurrentUser('tenantId'))
    if (data) {
      return user[data];
    }

    // 3. Par défaut, on retourne l'objet utilisateur complet
    return user;
  },
);
