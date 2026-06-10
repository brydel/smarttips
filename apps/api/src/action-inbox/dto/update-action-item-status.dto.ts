import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActionItemStatus } from '@prisma/client';

/** Seules les transitions manuelles OPEN → RESOLVED|DISMISSED sont permises. */
export const MANUAL_TARGET_STATUSES = [
  ActionItemStatus.RESOLVED,
  ActionItemStatus.DISMISSED,
] as const;

export type ManualTargetStatus = (typeof MANUAL_TARGET_STATUSES)[number];

export class UpdateActionItemStatusDto {
  @ApiProperty({
    enum: MANUAL_TARGET_STATUSES,
    description: 'Statut cible. Une action OPEN peut être résolue ou ignorée.',
  })
  @IsIn(MANUAL_TARGET_STATUSES)
  status!: ManualTargetStatus;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Note de résolution optionnelle du manager.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
