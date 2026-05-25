import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DistributionMode, EmployeeRole } from '@prisma/client';

class RoleCoefficientsDto {
  @ApiPropertyOptional({
    example: 1.0,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle SERVER.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.SERVER]?: number;

  @ApiPropertyOptional({
    example: 0.9,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle BARTENDER.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.BARTENDER]?: number;

  @ApiPropertyOptional({
    example: 0.7,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle BUSSER.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.BUSSER]?: number;

  @ApiPropertyOptional({
    example: 0.6,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle HOST.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.HOST]?: number;

  @ApiPropertyOptional({
    example: 0.5,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle COOK.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.COOK]?: number;

  @ApiPropertyOptional({
    example: 0.8,
    minimum: 0.1,
    maximum: 2.0,
    description: 'Coefficient du rôle CHEF.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.1)
  @Max(2.0)
  [EmployeeRole.CHEF]?: number;
}

export class UpdateDistributionConfigDto {
  @ApiPropertyOptional({
    type: RoleCoefficientsDto,
    description:
      'Coefficients de pondération par rôle. Les valeurs absentes conservent la configuration existante.',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RoleCoefficientsDto)
  readonly roleCoefficients?: RoleCoefficientsDto;

  @ApiPropertyOptional({
    enum: DistributionMode,
    example: DistributionMode.RULES_ONLY,
    description: 'Mode de calcul de la distribution. Pour le moment, seul RULES_ONLY est activé.',
  })
  @IsOptional()
  @IsEnum(DistributionMode)
  @IsIn([DistributionMode.RULES_ONLY], {
    message: 'error.distributionConfig.modeNotAvailable',
  })
  readonly mode?: DistributionMode;

  @ApiPropertyOptional({
    example: 35,
    minimum: 1,
    maximum: 100,
    description: 'Pourcentage maximal du pool qu’un seul employé peut recevoir.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100)
  readonly maxSharePct?: number;

  @ApiPropertyOptional({
    example: 2.0,
    minimum: 0,
    maximum: 50,
    description: 'Montant minimum garanti par heure travaillée.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  readonly minPerHour?: number;

  @ApiPropertyOptional({
    example: 0.5,
    minimum: 0,
    maximum: 1,
    description:
      'Poids du bonus de ventes dans le calcul. 0 = ventes ignorées, 1 = impact maximal.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  readonly salesBonusWeight?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Active ou désactive le bonus d’ancienneté. Prévu pour les futures versions.',
  })
  @IsOptional()
  @IsBoolean()
  readonly tenureBonusEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Active ou désactive l’audit de fairness. Prévu pour les futures versions.',
  })
  @IsOptional()
  @IsBoolean()
  readonly fairnessAuditEnabled?: boolean;

  @ApiPropertyOptional({
    example: 30,
    minimum: 1,
    maximum: 365,
    description: 'Seuil de cold start en jours pour les futures fonctionnalités ML/fairness.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  readonly coldStartThreshold?: number;
}
