import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
    description: 'UUID v4 du shift auquel la commande est rattachée.',
  })
  @IsUUID('4')
  readonly shiftId!: string;

  @ApiProperty({
    example: 'cddf1fc4-b41f-4d2d-8dbf-841d61632df9',
    description: 'UUID v4 de la table du restaurant.',
  })
  @IsUUID('4')
  readonly tableId!: string;

  @ApiProperty({
    example: 'bdf71250-363f-4d80-b947-51a7b95dee07',
    description: 'UUID v4 du serveur responsable de la commande.',
  })
  @IsUUID('4')
  readonly serverId!: string;

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

  @ApiProperty({
    type: [CreateOrderItemDto],
    minItems: 1,
    maxItems: 100,
    description: 'Liste des items commandés.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  readonly items!: CreateOrderItemDto[];
}
