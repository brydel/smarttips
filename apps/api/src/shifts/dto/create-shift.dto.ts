import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShiftType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateShiftDto {
  @ApiProperty({
    example: '2026-05-21',
    description: 'Date du shift au format YYYY-MM-DD.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly date!: string;

  @ApiProperty({
    enum: ShiftType,
    example: ShiftType.DINNER,
  })
  @IsEnum(ShiftType)
  readonly shiftType!: ShiftType;

  @ApiProperty({
    example: '2026-05-21T17:00:00.000Z',
  })
  @IsDateString()
  readonly startTime!: string;

  @ApiProperty({
    example: '2026-05-22T01:00:00.000Z',
  })
  @IsDateString()
  readonly endTime!: string;

  @ApiPropertyOptional({
    example: 'Soirée très occupée prévue.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly notes?: string;
}
