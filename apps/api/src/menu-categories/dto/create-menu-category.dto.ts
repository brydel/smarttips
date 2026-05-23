import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateMenuCategoryDto {
  @ApiProperty({
    example: 'Plats principaux',
    description: 'Nom de la catégorie.',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'error.validation.name.invalid' })
  @IsNotEmpty({ message: 'error.validation.name.required' })
  @MinLength(2, { message: 'error.validation.name.tooShort' })
  @MaxLength(100, { message: 'error.validation.name.tooLong' })
  readonly name!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 0,
    maximum: 999,
    description: "Ordre d'affichage de la catégorie.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'error.validation.displayOrder.invalid' })
  @Min(0, { message: 'error.validation.displayOrder.negative' })
  @Max(999, { message: 'error.validation.displayOrder.tooHigh' })
  readonly displayOrder?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indique si la catégorie est active dès sa création.',
  })
  @IsOptional()
  @IsBoolean({ message: 'error.validation.active.invalid' })
  readonly active?: boolean;
}
