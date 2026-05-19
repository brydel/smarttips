import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * Surcharge optionnelle (mais recommandée) si tu as besoin de logique personnalisée
   * avant ou après l'activation du Guard.
   */
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  /**
   * Surcharge critique : Analyse le résultat de la validation Passport
   * @param err Erreur interne de Passport ou du système
   * @param user L'objet utilisateur retourné par JwtStrategy.validate()
   * @param info Contient les détails de l'échec (ex: JsonWebTokenError, TokenExpiredError)
   */
  override handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // 1. Si Passport ou le système a levé une erreur explicite, on la propage
    if (err) {
      this.logger.error(`Internal auth error: ${err.message}`, err.stack);
      throw err;
    }

    // 2. Si aucun utilisateur n'est trouvé ou validé (Token invalide, expiré ou absent)
    if (!user) {
      const request = context.switchToHttp().getRequest();
      const ip = request.ip || request.headers['x-forwarded-for'];
      const path = request.url;

      // Log précis côté serveur pour le debugging et la détection d'anomalies (sans tracker de données sensibles)
      this.logger.warn(
        `Unauthorized access attempt on [${path}] from IP [${ip}]. Reason: ${info?.message || 'No token provided'}`,
      );

      // Gestion fine de la clé d'erreur selon la cause exacte de l'échec
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('error.auth.token_expired');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('error.auth.invalid_token');
      }

      // Erreur générique standardisée pour l'i18n
      throw new UnauthorizedException('error.auth.unauthorized');
    }

    // 3. Tout est au vert, on injecte l'utilisateur validé dans l'objet Request
    return user;
  }
}
