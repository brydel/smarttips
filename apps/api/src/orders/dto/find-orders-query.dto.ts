import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindOrdersQueryDto {
  @ApiPropertyOptional({
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
    description: 'Filtrer les commandes par shift.',
  })
  @IsOptional()
  @IsUUID('4')
  readonly shiftId?: string;

  @ApiPropertyOptional({
    example: 'bdf71250-363f-4d80-b947-51a7b95dee07',
    description: 'Filtrer les commandes par serveur.',
  })
  @IsOptional()
  @IsUUID('4')
  readonly serverId?: string;

  @ApiPropertyOptional({
    example: 'cddf1fc4-b41f-4d2d-8dbf-841d61632df9',
    description: 'Filtrer les commandes par table.',
  })
  @IsOptional()
  @IsUUID('4')
  readonly tableId?: string;

  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.OPEN,
    description: 'Filtrer les commandes par statut.',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  readonly status?: OrderStatus;

  @ApiPropertyOptional({
    example: '2026-05-22',
    description: 'Filtrer les commandes ouvertes à cette date, format YYYY-MM-DD.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must use YYYY-MM-DD format.',
  })
  readonly date?: string;

  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    maximum: 100,
    description: 'Nombre maximum de commandes retournées.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;

  @ApiPropertyOptional({
    example: '90e93460-71e8-4eb4-9b62-42c29d4c48c9',
    description: 'Cursor de pagination basé sur l’UUID de la dernière commande reçue.',
  })
  @IsOptional()
  @IsUUID('4')
  readonly cursor?: string;
}
