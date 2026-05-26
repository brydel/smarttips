import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEmployeeInvitationDto {
  @ApiProperty({
    example: 'bdf71250-363f-4d80-b947-51a7b95dee07',
    format: 'uuid',
    description: 'UUID v4 de l’employé existant à inviter.',
  })
  @IsUUID('4', { message: 'error.validation.employeeId.invalid' })
  readonly employeeId!: string;

  @ApiProperty({
    example: 'employee@example.com',
    maxLength: 254,
    description: 'Adresse email à laquelle envoyer le magic link d’invitation.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString({ message: 'error.validation.email.invalid' })
  @IsEmail({}, { message: 'error.validation.email.invalid' })
  @MaxLength(254, { message: 'error.validation.email.tooLong' })
  readonly email!: string;
}
