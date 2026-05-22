import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrderDto {
  @ApiPropertyOptional({
    example: 4,
    minimum: 1,
    maximum: 100,
    description: 'Nombre de clients à la table.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly guestCount?: number;
}
