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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        PORT: Joi.number().default(3001),
      }),
    }),
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
  ],
})
export class AppModule {}
