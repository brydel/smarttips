import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeMeController } from './employee-me.controller';
import { EmployeeWalletService } from './employee-wallet.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesController, EmployeeMeController],
  providers: [EmployeesService, EmployeeWalletService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
