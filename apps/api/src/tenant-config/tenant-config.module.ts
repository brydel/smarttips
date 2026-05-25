import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigService } from './tenant-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
