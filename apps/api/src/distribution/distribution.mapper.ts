import { EmployeeRole, Prisma } from '@prisma/client';
import { DEFAULT_ROLE_COEFFICIENTS, DistributionConfig } from './distribution.types';

export function mapDistributionConfigFromPrisma(config: {
  roleCoefficients: Prisma.JsonValue;
  minPerHour: Prisma.Decimal;
  maxSharePct: Prisma.Decimal;
  salesBonusWeight: Prisma.Decimal;
}): DistributionConfig {
  return {
    roleCoefficients: parseRoleCoefficients(config.roleCoefficients),
    minimumPerHour: config.minPerHour,
    maxSharePercent: config.maxSharePct,
    salesBonusWeight: config.salesBonusWeight,
  };
}

function parseRoleCoefficients(value: Prisma.JsonValue): Record<EmployeeRole, Prisma.Decimal> {
  const defaults = DEFAULT_ROLE_COEFFICIENTS;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const raw = value as Record<string, unknown>;

  return {
    [EmployeeRole.SERVER]: toPositiveDecimalOrDefault(raw.SERVER, defaults.SERVER),
    [EmployeeRole.BARTENDER]: toPositiveDecimalOrDefault(raw.BARTENDER, defaults.BARTENDER),
    [EmployeeRole.BUSSER]: toPositiveDecimalOrDefault(raw.BUSSER, defaults.BUSSER),
    [EmployeeRole.HOST]: toPositiveDecimalOrDefault(raw.HOST, defaults.HOST),
    [EmployeeRole.COOK]: toPositiveDecimalOrDefault(raw.COOK, defaults.COOK),
    [EmployeeRole.CHEF]: toPositiveDecimalOrDefault(raw.CHEF, defaults.CHEF),
  };
}

function toPositiveDecimalOrDefault(value: unknown, fallback: Prisma.Decimal): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(String(value));

    if (decimal.lte(0)) {
      return fallback;
    }

    return decimal;
  } catch {
    return fallback;
  }
}
