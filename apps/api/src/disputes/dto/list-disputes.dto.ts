import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipDisputeCategory, TipDisputeStatus } from '@prisma/client';

/** Accepte `?status=OPEN` comme `?status=OPEN&status=IN_REVIEW`. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined || Array.isArray(value) ? value : [value];

export class ListDisputesDto {
  @ApiPropertyOptional({
    enum: TipDisputeStatus,
    isArray: true,
    description: 'Filtrer par statut.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(TipDisputeStatus, { each: true })
  status?: TipDisputeStatus[];

  @ApiPropertyOptional({
    enum: TipDisputeCategory,
    isArray: true,
    description: 'Filtrer par catégorie.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(TipDisputeCategory, { each: true })
  category?: TipDisputeCategory[];

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
