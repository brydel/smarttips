import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'error.validation.email.invalid' })
  @IsNotEmpty({ message: 'error.validation.email.required' })
  @MaxLength(254, { message: 'error.validation.email.max_length' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'error.validation.password.required' })
  @MinLength(8, { message: 'error.validation.password.min_length' })
  @MaxLength(64, { message: 'error.validation.password.max_length' })
  password!: string;
}
