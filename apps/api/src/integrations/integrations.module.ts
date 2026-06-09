import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';
import { ConnectorRegistry } from './connectors/connector-registry';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [IntegrationsRepository, IntegrationsService, ConnectorRegistry],
  exports: [IntegrationsRepository, IntegrationsService, ConnectorRegistry],
})
export class IntegrationsModule {}
