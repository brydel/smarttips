import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import { MlClientModule } from '../ml-client/ml-client.module';
import { ML_TRAINING_QUEUE, MlTrainingProducer } from './ml-training.producer';
import { MlTrainingProcessor } from './ml-training.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const url = new URL(redisUrl);

        return {
          connection: {
            url: redisUrl,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: ML_TRAINING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1_000,
        },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    }),
    MlClientModule,
  ],
  providers: [MlTrainingProducer, MlTrainingProcessor],
  exports: [BullModule, MlTrainingProducer],
})
export class QueueModule {}
