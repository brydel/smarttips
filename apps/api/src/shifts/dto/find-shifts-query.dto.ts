import { Matches, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindShiftsQueryDto {
  @ApiPropertyOptional({
    description: 'Date au format YYYY-MM-DD.',
    example: '2026-05-21',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must use YYYY-MM-DD format.',
  })
  readonly date?: string;
}
