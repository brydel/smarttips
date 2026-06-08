import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { MlClientService } from '../ml-client/ml-client.service';
import {
  isMlTrainingComputationMethod,
  ML_TRAINING_QUEUE,
  MlTrainingJobData,
} from './ml-training.producer';

@Processor(ML_TRAINING_QUEUE)
export class MlTrainingProcessor extends WorkerHost {
  private readonly logger = new Logger(MlTrainingProcessor.name);

  constructor(private readonly mlClient: MlClientService) {
    super();
  }

  async process(job: Job<MlTrainingJobData>): Promise<void> {
    const { tenantId, shiftId, computationMethod } = job.data;

    if (!isMlTrainingComputationMethod(computationMethod)) {
      this.logger.warn({
        event: 'ml_training_job_skipped',
        tenantId,
        shiftId,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        computationMethod,
      });
      return;
    }

    this.logger.log({
      event: 'ml_training_job_started',
      tenantId,
      shiftId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    });

    await this.mlClient.trainOnFeedback({
      tenantId,
      shiftId,
      employees: job.data.employees,
      idempotencyKey: job.data.idempotencyKey,
    });

    this.logger.log({
      event: 'ml_training_job_completed',
      tenantId,
      shiftId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    });
  }
}
