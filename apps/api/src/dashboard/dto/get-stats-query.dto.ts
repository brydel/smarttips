import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum StatsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
}

export class GetStatsQueryDto {
  @ApiPropertyOptional({
    enum: StatsPeriod,
    default: StatsPeriod.TODAY,
    description:
      'Aggregation window. tenantId is always extracted from the JWT — never from this query.',
  })
  @IsOptional()
  @IsEnum(StatsPeriod)
  readonly period: StatsPeriod = StatsPeriod.TODAY;
}
