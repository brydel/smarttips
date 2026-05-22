import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({
    example: 6.25,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  readonly hoursWorked?: number;

  @ApiPropertyOptional({
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  readonly breakMinutes?: number;

  @ApiPropertyOptional({
    example: '2026-05-21T17:03:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  readonly checkInAt?: string;

  @ApiPropertyOptional({
    example: '2026-05-22T00:54:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  readonly checkOutAt?: string;

  @ApiPropertyOptional({
    enum: AssignmentStatus,
  })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  readonly status?: AssignmentStatus;
}
