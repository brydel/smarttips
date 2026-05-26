import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AcceptEmployeeInvitationDto {
  @ApiProperty({
    example: 'John',
    minLength: 1,
    maxLength: 100,
    description: 'Prénom de l’employé qui accepte l’invitation.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'error.validation.firstName.invalid' })
  @IsNotEmpty({ message: 'error.validation.firstName.required' })
  @MaxLength(100, { message: 'error.validation.firstName.tooLong' })
  readonly firstName!: string;

  @ApiProperty({
    example: 'Doe',
    minLength: 1,
    maxLength: 100,
    description: 'Nom de famille de l’employé qui accepte l’invitation.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'error.validation.lastName.invalid' })
  @IsNotEmpty({ message: 'error.validation.lastName.required' })
  @MaxLength(100, { message: 'error.validation.lastName.tooLong' })
  readonly lastName!: string;

  @ApiProperty({
    example: 'Sup3rS3cur3!',
    minLength: 8,
    maxLength: 72,
    description: 'Mot de passe du futur compte employé. Limité à 72 caractères pour bcrypt.',
  })
  @IsString({ message: 'error.validation.password.invalid' })
  @MinLength(8, { message: 'error.validation.password.tooShort' })
  @MaxLength(72, { message: 'error.validation.password.tooLong' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'error.validation.password.weak',
  })
  readonly password!: string;
}
