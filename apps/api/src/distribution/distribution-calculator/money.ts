import { Prisma } from '@prisma/client';

const CENTS_PER_DOLLAR = 100;

export function toDecimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function toCents(value: Prisma.Decimal): number {
  return value.mul(CENTS_PER_DOLLAR).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

export function centsToDecimal(cents: number): Prisma.Decimal {
  if (!Number.isInteger(cents)) {
    throw new Error('error.money.cents_must_be_integer');
  }

  if (cents < 0) {
    throw new Error('error.money.cents_must_be_non_negative');
  }

  return new Prisma.Decimal(cents).div(CENTS_PER_DOLLAR).toDecimalPlaces(2);
}

export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, val) => acc.add(val), new Prisma.Decimal(0));
}

export function assertNonNegativeMoney(value: Prisma.Decimal, errorCode: string): void {
  if (value.lt(0)) {
    throw new Error(errorCode);
  }
}

export function assertPoolIntegrity(distributed: Prisma.Decimal, poolTotal: Prisma.Decimal): void {
  const distributedCents = toCents(distributed);
  const poolTotalCents = toCents(poolTotal);

  if (distributedCents !== poolTotalCents) {
    throw new Error(
      `error.distribution.pool_integrity_violated: distributed=${distributed.toString()}, pool=${poolTotal.toString()}`,
    );
  }
}

export function decimalToJson(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(4).toFixed(4);
}

export function moneyToJson(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2).toFixed(2);
}
