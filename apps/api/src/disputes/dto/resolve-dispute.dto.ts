import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipDisputeOutcome } from '@prisma/client';

/**
 * Issues honnêtes uniquement : un litige n'ajuste JAMAIS un montant.
 * EXPLAINED = explication fournie, aucun changement.
 * MANUAL_FOLLOW_UP = suivi manuel hors système par le gestionnaire.
 */
export const DISPUTE_OUTCOMES = [
  TipDisputeOutcome.EXPLAINED,
  TipDisputeOutcome.MANUAL_FOLLOW_UP,
] as const;

export class ResolveDisputeDto {
  @ApiProperty({
    enum: DISPUTE_OUTCOMES,
    description: 'Issue de la résolution. Aucune issue ne modifie un paiement.',
  })
  @IsIn(DISPUTE_OUTCOMES)
  outcome!: TipDisputeOutcome;

  @ApiProperty({
    minLength: 5,
    maxLength: 1000,
    description: 'Note de résolution obligatoire, visible par l’employé.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  resolutionNote!: string;
}
