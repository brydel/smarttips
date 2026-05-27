import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { IsDateOnly, IsValidDateRange, trimString } from '../validators/date-range.validator';

const AUDIT_EXPORT_MAX_DAYS = 31;

export class AuditQueryDto {
  @ApiProperty({
    example: '2026-05-01',
    description: 'Date de début de l’audit trail, au format YYYY-MM-DD.',
  })
  @Transform(({ value }) => trimString(value))
  @IsString({ message: 'error.validation.from.mustBeString' })
  @IsNotEmpty({ message: 'error.validation.from.required' })
  @IsDateOnly({ message: 'error.validation.from.invalidDateOnly' })
  readonly from!: string;

  @ApiProperty({
    example: '2026-05-31',
    description:
      'Date de fin de l’audit trail, au format YYYY-MM-DD. Doit être >= from et couvrir au maximum 31 jours.',
  })
  @Transform(({ value }) => trimString(value))
  @IsString({ message: 'error.validation.to.mustBeString' })
  @IsNotEmpty({ message: 'error.validation.to.required' })
  @IsDateOnly({ message: 'error.validation.to.invalidDateOnly' })
  @IsValidDateRange('from', AUDIT_EXPORT_MAX_DAYS, {
    message: 'error.validation.dateRange.invalidOrTooLarge',
  })
  readonly to!: string;
}
