import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnlyUtc(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (!DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-');

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  const isRealCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  return isRealCalendarDate ? parsed : null;
}

export function IsDateOnly(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return parseDateOnlyUtc(value) !== null;
        },
      },
    });
  };
}

export function IsValidDateRange(
  fromProperty: string,
  maxDaysInclusive: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isValidDateRange',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [fromProperty, maxDaysInclusive],
      options: validationOptions,
      validator: {
        validate(toValue: unknown, args: ValidationArguments): boolean {
          const [fromPropertyName, maxDays] = args.constraints as [string, number];

          const objectWithDates = args.object as Record<string, unknown>;
          const fromValue = objectWithDates[fromPropertyName];

          const fromDate = parseDateOnlyUtc(fromValue);
          const toDate = parseDateOnlyUtc(toValue);

          if (fromDate === null || toDate === null) {
            return false;
          }

          const diffMs = toDate.getTime() - fromDate.getTime();

          if (diffMs < 0) {
            return false;
          }

          const diffDaysInclusive = Math.floor(diffMs / 86_400_000) + 1;

          return diffDaysInclusive <= maxDays;
        },
      },
    });
  };
}

export function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
