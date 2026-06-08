import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MlClientModule } from '../ml-client/ml-client.module';
import { QueueModule } from '../queue/queue.module';
import { DistributionCalculatorService } from './distribution-calculator/distribution-calculator.service';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';

@Module({
  imports: [PrismaModule, MlClientModule, QueueModule],
  controllers: [DistributionController],
  providers: [DistributionService, DistributionCalculatorService],
  exports: [DistributionService],
})
export class DistributionModule {}
