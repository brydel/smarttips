import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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

  app.setGlobalPrefix('api/v1');

  const frontendUrlString = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const allowedOrigins = frontendUrlString.split(',').map((url) => url.trim());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.match(/^https:\/\/smarttips.*\.vercel\.app$/) !== null ||
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

  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);
  logger.log(`Application SmartTips running in [${nodeEnv}] mode on port: ${port}`);
  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
