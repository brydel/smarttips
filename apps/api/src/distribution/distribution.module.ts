import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DistributionCalculatorService } from './distribution-calculator/distribution-calculator.service';
import { DistributionController } from './distribution.controller';
import { DistributionMlClient } from './distribution-ml.client';
import { DistributionService } from './distribution.service';

@Module({
  imports: [PrismaModule],
  controllers: [DistributionController],
  providers: [DistributionService, DistributionCalculatorService, DistributionMlClient],
  exports: [DistributionService],
})
export class DistributionModule {}
