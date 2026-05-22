import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    example: 'ee271c3e-acfc-4e9b-b266-831ecee0da38',
    description: 'UUID v4 du menu item à ajouter à la commande.',
  })
  @IsUUID('4')
  readonly menuItemId!: string;

  @ApiProperty({
    example: 2,
    minimum: 1,
    maximum: 999,
    description: 'Quantité de cet item dans la commande.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  readonly quantity!: number;

  @ApiPropertyOptional({
    example: 'Sans gluten',
    maxLength: 500,
    description: 'Note optionnelle pour la cuisine ou le service.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  readonly notes?: string;
}
