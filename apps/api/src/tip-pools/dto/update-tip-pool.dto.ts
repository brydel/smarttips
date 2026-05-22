import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateTipPoolDto {
  @ApiPropertyOptional({
    example: 130.0,
    minimum: 0,
    maximum: 99999.99,
    description: 'Montant corrigé des pourboires reçus en cash.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  readonly cashAmount?: number;

  @ApiPropertyOptional({
    example: 240.0,
    minimum: 0,
    maximum: 99999.99,
    description: 'Montant corrigé des pourboires reçus par carte.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  readonly cardAmount?: number;

  @ApiPropertyOptional({
    example: 'Correction après vérification du rapport de caisse.',
    maxLength: 500,
    description: 'Note interne optionnelle sur la correction du pool.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  readonly notes?: string;
}
