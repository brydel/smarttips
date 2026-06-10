import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DisputesService } from './disputes.service';
import { EmployeeDisputesController } from './employee-disputes.controller';
import { ManagerDisputesController } from './manager-disputes.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [EmployeeDisputesController, ManagerDisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
