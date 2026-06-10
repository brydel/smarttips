import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActionItemSeverity, ActionItemStatus, ActionItemType } from '@prisma/client';

/** Accepte `?status=OPEN` comme `?status[]=OPEN&status[]=RESOLVED`. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined || Array.isArray(value) ? value : [value];

export class ListActionItemsDto {
  @ApiPropertyOptional({
    enum: ActionItemStatus,
    isArray: true,
    description: 'Filtrer par statut.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(ActionItemStatus, { each: true })
  status?: ActionItemStatus[];

  @ApiPropertyOptional({
    enum: ActionItemSeverity,
    isArray: true,
    description: 'Filtrer par sévérité.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(3)
  @IsEnum(ActionItemSeverity, { each: true })
  severity?: ActionItemSeverity[];

  @ApiPropertyOptional({
    enum: ActionItemType,
    isArray: true,
    description: 'Filtrer par type de détecteur.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(ActionItemType, { each: true })
  type?: ActionItemType[];

  @ApiPropertyOptional({ description: 'Filtrer par shift.' })
  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

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
