import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { ShiftsModule } from './shifts/shifts.module';
import { OrdersModule } from './orders/orders.module';
import { TipPoolsModule } from './tip-pools/tip-pools.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DistributionModule } from './distribution/distribution.module';
import { TenantConfigModule } from './tenant-config/tenant-config.module';
import { InvitationsModule } from './invitations/invitations.module';
import { EmailModule } from './email/email.module';
import { AuditModule } from './audit/audit.module';
import { ActionInboxModule } from './action-inbox/action-inbox.module';
import { ReportsModule } from './reports/reports.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MlClientModule } from './ml-client/ml-client.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        PORT: Joi.number().default(3001),
        API_PORT: Joi.number().default(3001),
        REDIS_URL: Joi.string()
          .uri({ scheme: ['redis', 'rediss'] })
          .required(),
        ML_SERVICE_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .required(),
        INTERNAL_ML_TOKEN: Joi.string().min(1).required(),
        ML_SERVICE_ALLOWED_HOSTS: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().min(1).required(),
          otherwise: Joi.string().allow('', null).optional(),
        }),
        ML_PREDICT_TIMEOUT_MS: Joi.number().integer().min(10).max(2_000).default(150),
        ML_TRAIN_TIMEOUT_MS: Joi.number().integer().min(100).max(30_000).default(2_000),
        ML_TRAIN_MAX_ATTEMPTS: Joi.number().integer().min(1).max(5).default(3),
        ML_TRAIN_BACKOFF_BASE_MS: Joi.number().integer().min(10).max(2_000).default(200),
        ML_MAX_BODY_BYTES: Joi.number().integer().min(16_384).max(1_048_576).default(256_000),
      }),
    }),
    MlClientModule,
    QueueModule,
    PrismaModule,
    AuthModule,
    EmployeesModule,
    MenuItemsModule,
    ShiftsModule,
    OrdersModule,
    TipPoolsModule,
    MenuCategoriesModule,
    DashboardModule,
    DistributionModule,
    TenantConfigModule,
    InvitationsModule,
    EmailModule,
    AuditModule,
    ActionInboxModule,
    ReportsModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
