import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

import { trimString } from '../validators/date-range.validator';

export class TipPoolQueryDto {
  @ApiProperty({
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
    description: 'UUID v4 du shift à exporter en PDF.',
  })
  @Transform(({ value }) => trimString(value))
  @IsString({ message: 'error.validation.shiftId.mustBeString' })
  @IsNotEmpty({ message: 'error.validation.shiftId.required' })
  @IsUUID('4', { message: 'error.validation.shiftId.invalid' })
  readonly shiftId!: string;
}
