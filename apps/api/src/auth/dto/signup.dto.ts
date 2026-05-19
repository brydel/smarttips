import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignupDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'error.validation.email.invalid' })
  @IsNotEmpty({ message: 'error.validation.email.required' })
  @MaxLength(254, { message: 'error.validation.email.max_length' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'error.validation.password.min_length' })
  @MaxLength(64, { message: 'error.validation.password.max_length' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'error.validation.password.complexity',
  })
  password!: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'error.validation.name.required' })
  @MinLength(2, { message: 'error.validation.name.min_length' })
  @MaxLength(100, { message: 'error.validation.name.max_length' })
  name!: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'error.validation.restaurant.required' })
  @MinLength(2, { message: 'error.validation.restaurant.min_length' })
  @MaxLength(100, { message: 'error.validation.restaurant.max_length' })
  restaurantName!: string;
}
