import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [IntegrationsRepository, IntegrationsService],
  exports: [IntegrationsRepository, IntegrationsService],
})
export class IntegrationsModule {}
