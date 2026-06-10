import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ActionInboxController } from './action-inbox.controller';
import { ActionInboxService } from './action-inbox.service';
import { ActionInboxDetectorsService } from './action-inbox-detectors.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ActionInboxController],
  providers: [ActionInboxService, ActionInboxDetectorsService],
})
export class ActionInboxModule {}
