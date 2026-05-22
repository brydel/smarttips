import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateTipPoolDto {
  @ApiProperty({
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
    description: 'UUID v4 du shift pour lequel le pool de pourboires est déclaré.',
  })
  @IsUUID('4')
  readonly shiftId!: string;

  @ApiProperty({
    example: 120.5,
    minimum: 0,
    maximum: 99999.99,
    description: 'Montant des pourboires reçus en cash.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  readonly cashAmount!: number;

  @ApiProperty({
    example: 229.5,
    minimum: 0,
    maximum: 99999.99,
    description: 'Montant des pourboires reçus par carte.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  readonly cardAmount!: number;

  @ApiPropertyOptional({
    example: 'Soirée exceptionnelle, tips cash inclus.',
    maxLength: 500,
    description: 'Note interne optionnelle sur la déclaration du pool.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  readonly notes?: string;
}
