import { Module } from '@nestjs/common';
import { TipPoolsController } from './tip-pools.controller';
import { TipPoolsService } from './tip-pools.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TipPoolsController],
  providers: [TipPoolsService],
  exports: [TipPoolsService],
})
export class TipPoolsModule {}
