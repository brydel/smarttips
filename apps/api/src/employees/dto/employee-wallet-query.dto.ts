import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const WALLET_RANGES = ['7d', '30d', '90d', 'all'] as const;

export type WalletRange = (typeof WALLET_RANGES)[number];

export class EmployeeWalletQueryDto {
  @ApiPropertyOptional({
    enum: WALLET_RANGES,
    default: '30d',
    description: 'Fenêtre de l’historique des pourboires.',
  })
  @IsOptional()
  @IsIn(WALLET_RANGES)
  range?: WalletRange;
}
