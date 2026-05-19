import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'; // Protection des en-têtes HTTP
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  // 1. SÉCURITÉ : En-têtes HTTP sécurisés via Helmet
  // En développement local, on désactive CSP si on utilise GraphQL/Swagger Playground, sinon on l'active
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  // 2. COOKIES : Activation du parsing des cookies pour les refresh tokens
  app.use(cookieParser());

  // 3. VALIDATION : Configuration stricte et uniformisation des erreurs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // On intercepte les erreurs de validation pour renvoyer un format de clé i18n standardisé
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((err) => ({
          field: err.property,
          error: `error.validation.${err.property}.${Object.keys(err.constraints || {})[0]}`,
        }));
        return new BadRequestException({
          statusCode: 400,
          message: 'error.validation.failed',
          errors: formattedErrors,
        });
      },
    }),
  );

  // 4. ROUTING : Préfixe global globalisé
  app.setGlobalPrefix('api/v1');

  // 5. SÉCURITÉ & PROD : Configuration CORS dynamique pour gérer le multi-origine
  const frontendUrlString = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  // On sépare par des virgules pour autoriser plusieurs URLs dans le .env
  const allowedOrigins = frontendUrlString.split(',').map((url) => url.trim());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Autorise les requêtes sans origine (comme Postman, les apps mobiles ou serveurs internes)
      // ou si l'origine est explicitement dans la liste blanche
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (nodeEnv !== 'production' && origin.startsWith('http://localhost:'))
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Policy: Origin ${origin} is not allowed.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  // 6. INITIALISATION : Démarrage de l'application sur le port configuré
  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);

  logger.log(` Application SmartTips fonctionnelle en mode [${nodeEnv}] sur le port : ${port}`);
  logger.log(` Origines CORS autorisées : ${allowedOrigins.join(', ')}`);
}

bootstrap();
