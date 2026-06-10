import { Controller, Get, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { EmployeeWalletService } from './employee-wallet.service';
import { EmployeeWalletQueryDto } from './dto/employee-wallet-query.dto';

import { UserRole } from '../auth/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Espace personnel employé (BIS-55) : portefeuille de pourboires.
 * Strictement réservé au rôle EMPLOYEE : OWNER et MANAGER reçoivent 403,
 * ils disposent déjà des vues de distribution complètes côté dashboard.
 * L'identité vient exclusivement du JWT — aucun employeeId accepté en entrée.
 */
@ApiTags('Employee Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Réservé au rôle EMPLOYEE.',
})
@ApiNotFoundResponse({
  description: "Aucun dossier employé actif lié à l'utilisateur authentifié.",
})
@Controller('employee/me')
export class EmployeeMeController {
  constructor(private readonly walletService: EmployeeWalletService) {}

  @Get('dashboard')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Synthèse personnelle des pourboires',
    description:
      'Totaux 7/30 jours, tendance quotidienne sur 30 jours et dernier shift avec explication redactée. Données limitées à l’employé authentifié.',
  })
  @ApiOkResponse({ description: 'Synthèse retournée avec succès.' })
  async getDashboard(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,
  ) {
    return this.walletService.getDashboard(tenantId, userId);
  }

  @Get('distributions')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Historique personnel des pourboires par shift',
    description:
      'Distributions de l’employé authentifié sur pools calculés ou finalisés, avec statut honnête et explication redactée. Filtre ?range=7d|30d|90d|all.',
  })
  @ApiOkResponse({ description: 'Historique retourné avec succès.' })
  async getDistributions(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Query()
    dto: EmployeeWalletQueryDto,
  ) {
    return this.walletService.getDistributions(tenantId, userId, dto.range);
  }
}
