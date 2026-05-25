import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DistributionMode, EmployeeRole, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateDistributionConfigDto } from './dto/update-distribution-config.dto';
import { DEFAULT_ROLE_COEFFICIENTS } from '../distribution/distribution.types';
import {
  decimalToJson,
  moneyToJson,
  toDecimal,
} from '../distribution/distribution-calculator/money';

type DistributionConfigSource = 'DEFAULT' | 'CUSTOM';

type DistributionConfigResponse = {
  source: DistributionConfigSource;
  mode: DistributionMode;
  roleCoefficients: Record<EmployeeRole, string>;
  minPerHour: string;
  maxSharePct: string;
  salesBonusWeight: string;
  tenureBonusEnabled: boolean;
  fairnessAuditEnabled: boolean;
  coldStartThreshold: number;
  updatedAt: Date | null;
};

type PersistedDistributionConfig = {
  mode: DistributionMode;
  roleCoefficients: Prisma.JsonValue;
  minPerHour: Prisma.Decimal;
  maxSharePct: Prisma.Decimal;
  salesBonusWeight: Prisma.Decimal;
  tenureBonusEnabled: boolean;
  fairnessAuditEnabled: boolean;
  coldStartThreshold: number;
  updatedAt: Date;
};

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getDistributionConfig(tenantId: string): Promise<DistributionConfigResponse> {
    const config = await this.prisma.distributionConfig.findUnique({
      where: {
        tenantId,
      },
      select: this.distributionConfigSelect,
    });

    if (!config) {
      return this.buildDefaultConfigResponse();
    }

    return this.buildConfigResponse(config, 'CUSTOM');
  }

  async upsertDistributionConfig(
    tenantId: string,
    userId: string,
    dto: UpdateDistributionConfigDto,
  ): Promise<DistributionConfigResponse> {
    this.assertNonEmptyUpdate(dto);

    if (dto.mode && dto.mode !== DistributionMode.RULES_ONLY) {
      throw new BadRequestException('error.distributionConfig.modeNotAvailable');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenantExists = await tx.tenant.findFirst({
        where: {
          id: tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!tenantExists) {
        throw new NotFoundException('error.tenant.notFound');
      }

      const current = await tx.distributionConfig.findUnique({
        where: {
          tenantId,
        },
        select: this.distributionConfigSelect,
      });

      const baseConfig = current ?? this.buildDefaultConfigForMerge();

      const roleCoefficients = this.mergeRoleCoefficients(
        baseConfig.roleCoefficients,
        dto.roleCoefficients,
      );

      const data = {
        mode: dto.mode ?? baseConfig.mode,
        roleCoefficients: roleCoefficients as Prisma.InputJsonValue,
        minPerHour:
          dto.minPerHour !== undefined ? toDecimal(dto.minPerHour) : baseConfig.minPerHour,
        maxSharePct:
          dto.maxSharePct !== undefined ? toDecimal(dto.maxSharePct) : baseConfig.maxSharePct,
        salesBonusWeight:
          dto.salesBonusWeight !== undefined
            ? toDecimal(dto.salesBonusWeight)
            : baseConfig.salesBonusWeight,
        tenureBonusEnabled: dto.tenureBonusEnabled ?? baseConfig.tenureBonusEnabled,
        fairnessAuditEnabled: dto.fairnessAuditEnabled ?? baseConfig.fairnessAuditEnabled,
        coldStartThreshold: dto.coldStartThreshold ?? baseConfig.coldStartThreshold,
        updatedBy: userId,
      };

      const saved = await tx.distributionConfig.upsert({
        where: {
          tenantId,
        },
        create: {
          tenantId,
          ...data,
        },
        update: data,
        select: this.distributionConfigSelect,
      });

      return this.buildConfigResponse(saved, 'CUSTOM');
    });
  }

  async resetToDefaults(tenantId: string, userId: string): Promise<DistributionConfigResponse> {
    return this.prisma.$transaction(async (tx) => {
      const tenantExists = await tx.tenant.findFirst({
        where: {
          id: tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!tenantExists) {
        throw new NotFoundException('error.tenant.notFound');
      }

      const defaults = this.buildDefaultConfigForStorage(userId);

      const saved = await tx.distributionConfig.upsert({
        where: {
          tenantId,
        },
        create: {
          tenantId,
          ...defaults,
        },
        update: defaults,
        select: this.distributionConfigSelect,
      });

      return this.buildConfigResponse(saved, 'CUSTOM');
    });
  }

  private readonly distributionConfigSelect = {
    mode: true,
    roleCoefficients: true,
    minPerHour: true,
    maxSharePct: true,
    salesBonusWeight: true,
    tenureBonusEnabled: true,
    fairnessAuditEnabled: true,
    coldStartThreshold: true,
    updatedAt: true,
  } satisfies Prisma.DistributionConfigSelect;

  private assertNonEmptyUpdate(dto: UpdateDistributionConfigDto): void {
    if (
      dto.roleCoefficients === undefined &&
      dto.mode === undefined &&
      dto.maxSharePct === undefined &&
      dto.minPerHour === undefined &&
      dto.salesBonusWeight === undefined &&
      dto.tenureBonusEnabled === undefined &&
      dto.fairnessAuditEnabled === undefined &&
      dto.coldStartThreshold === undefined
    ) {
      throw new BadRequestException('error.distributionConfig.emptyUpdate');
    }
  }

  private buildDefaultConfigResponse(): DistributionConfigResponse {
    const defaults = this.buildDefaultConfigForMerge();

    return {
      source: 'DEFAULT',
      mode: defaults.mode,
      roleCoefficients: this.normalizeRoleCoefficients(defaults.roleCoefficients),
      minPerHour: moneyToJson(defaults.minPerHour),
      maxSharePct: moneyToJson(defaults.maxSharePct),
      salesBonusWeight: decimalToJson(defaults.salesBonusWeight),
      tenureBonusEnabled: defaults.tenureBonusEnabled,
      fairnessAuditEnabled: defaults.fairnessAuditEnabled,
      coldStartThreshold: defaults.coldStartThreshold,
      updatedAt: null,
    };
  }

  private buildConfigResponse(
    config: PersistedDistributionConfig,
    source: DistributionConfigSource,
  ): DistributionConfigResponse {
    return {
      source,
      mode: config.mode,
      roleCoefficients: this.normalizeRoleCoefficients(config.roleCoefficients),
      minPerHour: moneyToJson(config.minPerHour),
      maxSharePct: moneyToJson(config.maxSharePct),
      salesBonusWeight: decimalToJson(config.salesBonusWeight),
      tenureBonusEnabled: config.tenureBonusEnabled,
      fairnessAuditEnabled: config.fairnessAuditEnabled,
      coldStartThreshold: config.coldStartThreshold,
      updatedAt: config.updatedAt,
    };
  }

  private buildDefaultConfigForStorage(userId: string) {
    return {
      mode: DistributionMode.RULES_ONLY,
      roleCoefficients: this.buildDefaultRoleCoefficients() as Prisma.InputJsonValue,
      minPerHour: toDecimal(2),
      maxSharePct: toDecimal(35),
      salesBonusWeight: toDecimal(0.5),
      tenureBonusEnabled: true,
      fairnessAuditEnabled: true,
      coldStartThreshold: 30,
      updatedBy: userId,
    };
  }

  private buildDefaultConfigForMerge(): PersistedDistributionConfig {
    return {
      mode: DistributionMode.RULES_ONLY,
      roleCoefficients: this.buildDefaultRoleCoefficients(),
      minPerHour: toDecimal(2),
      maxSharePct: toDecimal(35),
      salesBonusWeight: toDecimal(0.5),
      tenureBonusEnabled: true,
      fairnessAuditEnabled: true,
      coldStartThreshold: 30,
      updatedAt: new Date(0),
    };
  }

  private buildDefaultRoleCoefficients(): Record<EmployeeRole, string> {
    return {
      [EmployeeRole.SERVER]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.SERVER]),
      [EmployeeRole.BARTENDER]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.BARTENDER]),
      [EmployeeRole.BUSSER]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.BUSSER]),
      [EmployeeRole.HOST]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.HOST]),
      [EmployeeRole.COOK]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.COOK]),
      [EmployeeRole.CHEF]: decimalToJson(DEFAULT_ROLE_COEFFICIENTS[EmployeeRole.CHEF]),
    };
  }

  private mergeRoleCoefficients(
    current: Prisma.JsonValue,
    updates?: Partial<Record<EmployeeRole, number>>,
  ): Record<EmployeeRole, string> {
    const normalized = this.normalizeRoleCoefficients(current);

    if (!updates) {
      return normalized;
    }

    const allowedRoles = Object.values(EmployeeRole);

    for (const [role, value] of Object.entries(updates)) {
      if (!allowedRoles.includes(role as EmployeeRole)) {
        throw new BadRequestException('error.distributionConfig.invalidRoleCoefficientKey');
      }

      if (value === undefined) {
        continue;
      }

      const decimal = toDecimal(value);

      if (decimal.lt(0.1) || decimal.gt(2)) {
        throw new BadRequestException('error.distributionConfig.invalidRoleCoefficientValue');
      }

      normalized[role as EmployeeRole] = decimalToJson(decimal);
    }

    return normalized;
  }

  private normalizeRoleCoefficients(value: Prisma.JsonValue): Record<EmployeeRole, string> {
    const defaults = this.buildDefaultRoleCoefficients();

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return defaults;
    }

    const raw = value as Record<string, unknown>;

    return {
      [EmployeeRole.SERVER]: this.toCoefficientOrDefault(
        raw[EmployeeRole.SERVER],
        defaults[EmployeeRole.SERVER],
      ),
      [EmployeeRole.BARTENDER]: this.toCoefficientOrDefault(
        raw[EmployeeRole.BARTENDER],
        defaults[EmployeeRole.BARTENDER],
      ),
      [EmployeeRole.BUSSER]: this.toCoefficientOrDefault(
        raw[EmployeeRole.BUSSER],
        defaults[EmployeeRole.BUSSER],
      ),
      [EmployeeRole.HOST]: this.toCoefficientOrDefault(
        raw[EmployeeRole.HOST],
        defaults[EmployeeRole.HOST],
      ),
      [EmployeeRole.COOK]: this.toCoefficientOrDefault(
        raw[EmployeeRole.COOK],
        defaults[EmployeeRole.COOK],
      ),
      [EmployeeRole.CHEF]: this.toCoefficientOrDefault(
        raw[EmployeeRole.CHEF],
        defaults[EmployeeRole.CHEF],
      ),
    };
  }

  private toCoefficientOrDefault(value: unknown, fallback: string): string {
    try {
      if (value === null || value === undefined) {
        return fallback;
      }

      const decimal = toDecimal(String(value));

      if (decimal.lt(0.1) || decimal.gt(2)) {
        return fallback;
      }

      return decimalToJson(decimal);
    } catch {
      return fallback;
    }
  }
}
