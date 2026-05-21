import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum EmployeeRole {
  SERVER = 'SERVER',
  BUSSER = 'BUSSER',
  BARTENDER = 'BARTENDER',
  COOK = 'COOK',
  HOST = 'HOST',
}

export class CreateEmployeeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'error.validation.firstName.required' })
  @IsString({ message: 'error.validation.firstName.invalid' })
  @MinLength(2, { message: 'error.validation.firstName.tooShort' })
  @MaxLength(100, { message: 'error.validation.firstName.tooLong' })
  firstName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'error.validation.lastName.required' })
  @IsString({ message: 'error.validation.lastName.invalid' })
  @MinLength(2, { message: 'error.validation.lastName.tooShort' })
  @MaxLength(100, { message: 'error.validation.lastName.tooLong' })
  lastName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsNotEmpty({ message: 'error.validation.email.required' })
  @IsEmail({}, { message: 'error.validation.email.invalid' })
  @MaxLength(254, { message: 'error.validation.email.tooLong' })
  email!: string;

  @IsNotEmpty({ message: 'error.validation.role.required' })
  @IsEnum(EmployeeRole, { message: 'error.validation.role.invalid' })
  role!: EmployeeRole;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'error.validation.hourlyWage.invalid' })
  @Min(0, { message: 'error.validation.hourlyWage.negative' })
  @Max(200, { message: 'error.validation.hourlyWage.tooHigh' })
  hourlyWage!: number;

  @IsNotEmpty({ message: 'error.validation.hireDate.required' })
  @IsDateString({ strict: true }, { message: 'error.validation.hireDate.invalid' })
  hireDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'error.validation.coefficient.invalid' })
  @Min(0, { message: 'error.validation.coefficient.negative' })
  @Max(10, { message: 'error.validation.coefficient.tooHigh' }) // Empêche le siphonnage du pool
  coefficient?: number;
}
