import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_ALLOCATIONS_PER_ADJUSTMENT = 500;
const MAX_DISTRIBUTION_CENTS = 100_000_000;

export class AdjustDistributionAllocationDto {
  @ApiProperty({
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
    description: 'UUID v4 de l’employé.',
  })
  @IsUUID('4')
  readonly employeeId!: string;

  @ApiProperty({
    example: 6172,
    minimum: 0,
    maximum: MAX_DISTRIBUTION_CENTS,
    description: 'Montant final corrigé en cents entiers.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  )
  @IsInt({ message: 'error.distribution.invalidCents' })
  @Min(0, { message: 'error.distribution.invalidCents' })
  @Max(MAX_DISTRIBUTION_CENTS, { message: 'error.distribution.invalidCents' })
  readonly tipsCents!: number;
}

export class AdjustDistributionDto {
  @ApiProperty({
    type: [AdjustDistributionAllocationDto],
    minItems: 1,
    maxItems: MAX_ALLOCATIONS_PER_ADJUSTMENT,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ALLOCATIONS_PER_ADJUSTMENT)
  @ValidateNested({ each: true })
  @Type(() => AdjustDistributionAllocationDto)
  readonly allocations!: AdjustDistributionAllocationDto[];

  @ApiPropertyOptional({
    example: 'Correction validée par le manager.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  readonly reason?: string;
}
