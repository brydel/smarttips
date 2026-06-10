import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DisputesService } from './disputes.service';
import { ListDisputesDto } from './dto/list-disputes.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

import { UserRole } from '../auth/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Litiges côté manager (BIS-56) : file de traitement et résolution.
 * Réservé aux rôles OWNER et MANAGER. Tenant-scopé : tout litige hors
 * tenant répond 404. La résolution exige une note ; aucune issue ne
 * modifie un payout ou une distribution.
 */
@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'JWT manquant, expiré ou invalide.' })
@ApiForbiddenResponse({ description: 'Rôle insuffisant : réservé aux OWNER et MANAGER.' })
@Controller('disputes')
export class ManagerDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Lister les litiges du tenant',
    description:
      'File des litiges, filtrable par statut et catégorie, du plus récent au plus ancien.',
  })
  @ApiOkResponse({ description: 'Liste paginée retournée avec succès.' })
  async list(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Query()
    dto: ListDisputesDto,
  ) {
    return this.disputesService.list(tenantId, dto);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Détail d’un litige',
    description: 'Inclut la question de l’employé et le snapshot d’évidence immuable.',
  })
  @ApiOkResponse({ description: 'Litige retourné avec succès.' })
  @ApiNotFoundResponse({ description: 'Litige introuvable pour ce tenant.' })
  async getById(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.disputesService.getById(tenantId, id);
  }

  @Patch(':id/review')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Prendre en charge un litige',
    description: 'Transition OPEN → IN_REVIEW. Bloque le retrait par l’employé.',
  })
  @ApiOkResponse({ description: 'Litige pris en charge avec succès.' })
  @ApiBadRequestResponse({ description: 'Transition invalide.' })
  @ApiNotFoundResponse({ description: 'Litige introuvable pour ce tenant.' })
  async startReview(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.disputesService.startReview(tenantId, userId, id);
  }

  @Patch(':id/resolve')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Résoudre un litige',
    description:
      'Transition OPEN|IN_REVIEW → RESOLVED avec note obligatoire. EXPLAINED : explication fournie, aucun changement. MANUAL_FOLLOW_UP : suivi manuel par le gestionnaire — aucun montant n’est modifié par le système.',
  })
  @ApiBody({ type: ResolveDisputeDto })
  @ApiOkResponse({ description: 'Litige résolu avec succès.' })
  @ApiBadRequestResponse({ description: 'Transition ou payload invalide.' })
  @ApiNotFoundResponse({ description: 'Litige introuvable pour ce tenant.' })
  async resolve(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,

    @Body()
    dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(tenantId, userId, id, dto);
  }
}
