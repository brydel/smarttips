import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ComputationMethod } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Queue } from 'bullmq';

import {
  IdempotencyKey,
  ShiftId,
  TenantId,
  TrainEmployeeOutcome,
} from '../ml-client/ml-client.service';

export const ML_TRAINING_QUEUE = 'ml-training';
export const ML_TRAINING_JOB = 'train-on-feedback';

const ML_TRAINING_METHODS = new Set<ComputationMethod>([
  ComputationMethod.ML_ASSISTED,
  ComputationMethod.ML_FULL,
]);

export interface MlTrainingProducerInput {
  readonly tenantId: TenantId;
  readonly shiftId: ShiftId;
  readonly computationMethod: ComputationMethod;
  readonly employees: readonly TrainEmployeeOutcome[];
}

export interface MlTrainingJobData extends MlTrainingProducerInput {
  readonly idempotencyKey: IdempotencyKey;
}

@Injectable()
export class MlTrainingProducer {
  private readonly logger = new Logger(MlTrainingProducer.name);

  constructor(
    @InjectQueue(ML_TRAINING_QUEUE)
    private readonly queue: Queue<MlTrainingJobData>,
  ) {}

  async enqueue(input: MlTrainingProducerInput): Promise<void> {
    if (!ML_TRAINING_METHODS.has(input.computationMethod)) {
      this.logger.log({
        event: 'ml_training_enqueue_skipped',
        tenantId: input.tenantId,
        shiftId: input.shiftId,
        computationMethod: input.computationMethod,
      });
      return;
    }

    const contentHash = this.hashTargets(input.employees);
    const idempotencyKey = asIdempotencyKey(
      `${input.tenantId}:${input.shiftId}:distribution:${contentHash}`,
    );
    const data: MlTrainingJobData = {
      ...input,
      idempotencyKey,
    };

    await this.queue.add(ML_TRAINING_JOB, data, {
      jobId: idempotencyKey,
    });

    this.logger.log({
      event: 'ml_training_enqueued',
      tenantId: input.tenantId,
      shiftId: input.shiftId,
      jobId: idempotencyKey,
      computationMethod: input.computationMethod,
    });
  }

  private hashTargets(employees: readonly TrainEmployeeOutcome[]): string {
    const payload = employees
      .map((employee) => `${employee.employeeId}:${employee.tipsReceivedCents}`)
      .sort()
      .join('|');

    return createHash('sha256').update(payload).digest('hex');
  }
}

export function isMlTrainingComputationMethod(method: ComputationMethod): boolean {
  return ML_TRAINING_METHODS.has(method);
}

function asIdempotencyKey(value: string): IdempotencyKey {
  return value as IdempotencyKey;
}
