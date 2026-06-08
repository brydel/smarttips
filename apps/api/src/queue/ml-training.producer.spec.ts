import { ComputationMethod } from '@prisma/client';
import { Queue } from 'bullmq';

import {
  Cents,
  EmployeeId,
  ShiftId,
  TenantId,
  TrainEmployeeOutcome,
} from '../ml-client/ml-client.service';
import { ML_TRAINING_JOB, MlTrainingJobData, MlTrainingProducer } from './ml-training.producer';

function brand<T>(value: string | number): T {
  return value as T;
}

function employee(employeeId: string, tipsReceivedCents: number): TrainEmployeeOutcome {
  return {
    employeeId: brand<EmployeeId>(employeeId),
    role: 'SERVER',
    shiftType: 'DINNER',
    dayOfWeek: 4,
    hourStart: 17,
    hourEnd: 23,
    employeeCount: 2,
    salesTotalCents: brand<Cents>(20_000),
    assignedSalesCents: brand<Cents>(10_000),
    ordersCount: 10,
    tipsReceivedCents: brand<Cents>(tipsReceivedCents),
  };
}

function input(
  employees: readonly TrainEmployeeOutcome[],
  computationMethod: ComputationMethod = ComputationMethod.ML_FULL,
) {
  return {
    tenantId: brand<TenantId>('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    shiftId: brand<ShiftId>('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    computationMethod,
    employees,
  };
}

function queueMock(): Queue<MlTrainingJobData> {
  return {
    add: jest.fn(),
  } as unknown as Queue<MlTrainingJobData>;
}

describe('MlTrainingProducer', () => {
  it('uses stable idempotent job ids independent of employee order', async () => {
    const queue = queueMock();
    const producer = new MlTrainingProducer(queue);
    const employees = [employee('employee-b', 200), employee('employee-a', 100)];

    await producer.enqueue(input(employees));
    await producer.enqueue(input([...employees].reverse()));

    const firstJobId = (queue.add as jest.Mock).mock.calls[0][2].jobId;
    const secondJobId = (queue.add as jest.Mock).mock.calls[1][2].jobId;

    expect(firstJobId).toBe(secondJobId);
    expect(queue.add).toHaveBeenCalledWith(
      ML_TRAINING_JOB,
      expect.objectContaining({ idempotencyKey: firstJobId }),
      { jobId: firstJobId },
    );
  });

  it('changes job id when corrected target content changes', async () => {
    const queue = queueMock();
    const producer = new MlTrainingProducer(queue);

    await producer.enqueue(input([employee('employee-a', 100)]));
    await producer.enqueue(input([employee('employee-a', 101)]));

    expect((queue.add as jest.Mock).mock.calls[0][2].jobId).not.toBe(
      (queue.add as jest.Mock).mock.calls[1][2].jobId,
    );
  });

  it.each([ComputationMethod.RULES, ComputationMethod.MANUAL_OVERRIDE])(
    'does not enqueue feedback for %s distributions',
    async (computationMethod) => {
      const queue = queueMock();
      const producer = new MlTrainingProducer(queue);

      await producer.enqueue(input([employee('employee-a', 100)], computationMethod));

      expect(queue.add).not.toHaveBeenCalled();
    },
  );
});
