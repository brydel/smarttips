import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

export interface MlDistributionEmployeeInput {
  employeeId: string;
  role: string;
  shiftType: string;
  dayOfWeek: number;
  hourStart: number;
  hourEnd: number;
  employeeCount: number;
  salesTotalCents: number;
  assignedSalesCents: number;
  ordersCount: number;
}

export interface MlDistributionPredictInput {
  tenantId: string;
  shiftId: string;
  poolCents: number;
  employees: MlDistributionEmployeeInput[];
}

export interface MlDistributionAllocation {
  employeeId: string;
  tipsCents: number;
  weight: number;
  share: number;
}

export interface MlDistributionPredictResult {
  modelVersion: number;
  allocations: MlDistributionAllocation[];
}

@Injectable()
export class DistributionMlClient {
  private readonly serviceUrl?: string;
  private readonly sharedSecret?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.serviceUrl = this.normalizeUrl(config.get<string>('ML_SERVICE_URL'));
    this.sharedSecret = config.get<string>('ML_SERVICE_SHARED_SECRET');
    this.timeoutMs = Number(config.get<string>('ML_SERVICE_TIMEOUT_MS', '5000'));
  }

  isConfigured(): boolean {
    return Boolean(this.serviceUrl && this.sharedSecret);
  }

  async predictDistribution(
    input: MlDistributionPredictInput,
  ): Promise<MlDistributionPredictResult | null> {
    if (!this.serviceUrl || !this.sharedSecret) {
      return null;
    }

    try {
      const response = await axios.post<MlDistributionPredictResponse>(
        `${this.serviceUrl}/distribution/predict`,
        {
          tenant_id: input.tenantId,
          shift_id: input.shiftId,
          pool_cents: input.poolCents,
          employees: input.employees.map((employee) => ({
            employee_id: employee.employeeId,
            role: employee.role,
            shift_type: employee.shiftType,
            day_of_week: employee.dayOfWeek,
            hour_start: employee.hourStart,
            hour_end: employee.hourEnd,
            employee_count: employee.employeeCount,
            sales_total_cents: employee.salesTotalCents,
            assigned_sales_cents: employee.assignedSalesCents,
            orders_count: employee.ordersCount,
          })),
        },
        {
          headers: {
            'X-Internal-Token': this.sharedSecret,
            'X-Request-Id': `distribution-${input.tenantId}-${input.shiftId}`,
          },
          timeout: this.timeoutMs,
        },
      );

      return {
        modelVersion: response.data.model_version,
        allocations: response.data.allocations.map((allocation) => ({
          employeeId: allocation.employee_id,
          tipsCents: allocation.tips_cents,
          weight: allocation.weight,
          share: allocation.share,
        })),
      };
    } catch (error) {
      throw new MlDistributionUnavailableError(this.safeErrorMessage(error));
    }
  }

  private normalizeUrl(url: string | undefined): string | undefined {
    const trimmed = url?.trim();

    if (!trimmed) {
      return undefined;
    }

    return trimmed.replace(/\/+$/, '');
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return `error.mlDistribution.requestFailed.${error.response?.status ?? 'network'}`;
    }

    return 'error.mlDistribution.requestFailed';
  }
}

export class MlDistributionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MlDistributionUnavailableError';
  }
}

interface MlDistributionPredictResponse {
  model_version: number;
  allocations: Array<{
    employee_id: string;
    tips_cents: number;
    weight: number;
    share: number;
  }>;
}
