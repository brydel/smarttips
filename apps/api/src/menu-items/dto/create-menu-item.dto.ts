import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum MenuItemCategory {
  ENTREE = 'ENTREE',
  MAIN = 'MAIN',
  DESSERT = 'DESSERT',
  DRINK = 'DRINK',
  SIDE = 'SIDE',
}

export class CreateMenuItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'error.validation.name.required' })
  @IsString({ message: 'error.validation.name.invalid' })
  @MinLength(2, { message: 'error.validation.name.tooShort' })
  @MaxLength(255, { message: 'error.validation.name.tooLong' })
  name!: string;

  @IsNotEmpty({ message: 'error.validation.categoryId.required' })
  @IsUUID('4', { message: 'error.validation.categoryId.invalid' })
  categoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'error.validation.price.invalid' })
  @Min(0, { message: 'error.validation.price.negative' })
  @Max(2000, { message: 'error.validation.price.tooHigh' }) // Plafond de sécurité (ex: 2000$ pour une bouteille de vin rare)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'error.validation.cost.invalid' })
  @Min(0, { message: 'error.validation.cost.negative' })
  @Max(2000, { message: 'error.validation.cost.tooHigh' })
  cost?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'error.validation.description.empty' }) // Bloque les chaînes qui ne contiennent que des espaces
  @IsString({ message: 'error.validation.description.invalid' })
  @MaxLength(1000, { message: 'error.validation.description.tooLong' })
  description?: string;

  @IsOptional()
  // Accepte "true", "1", true, etc., et convertit proprement en booléen natif
  @Transform(({ value }) => {
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean({ message: 'error.validation.active.invalid' })
  active?: boolean;
}
