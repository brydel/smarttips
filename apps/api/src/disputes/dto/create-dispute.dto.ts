import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipDisputeCategory } from '@prisma/client';

export class CreateDisputeDto {
  @ApiProperty({ description: 'Distribution concernée (doit appartenir à l’employé).' })
  @IsUUID('4')
  tipDistributionId!: string;

  @ApiProperty({
    enum: TipDisputeCategory,
    description: 'Catégorie de la question : montant, heures, rôle ou autre.',
  })
  @IsEnum(TipDisputeCategory)
  category!: TipDisputeCategory;

  @ApiProperty({
    minLength: 10,
    maxLength: 2000,
    description: 'Description de la question par l’employé.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
