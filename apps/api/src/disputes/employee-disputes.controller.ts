import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

import { UserRole } from '../auth/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Litiges côté employé (BIS-56) : « Poser une question » sur une distribution.
 * Strictement réservé au rôle EMPLOYEE. L'identité vient exclusivement du JWT
 * (tenantId + userId) — aucun employeeId accepté en params/query/body.
 * Toute ressource hors tenant ou hors employé répond 404.
 */
@ApiTags('Employee Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'JWT manquant, expiré ou invalide.' })
@ApiForbiddenResponse({ description: 'Réservé au rôle EMPLOYEE.' })
@ApiNotFoundResponse({
  description: "Ressource introuvable pour l'employé authentifié (ou aucun dossier employé lié).",
})
@Controller('employee/me/disputes')
export class EmployeeDisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Ouvrir un litige sur une de ses distributions',
    description:
      'Capture un snapshot d’évidence immuable et redacté à la création. Un seul litige actif par distribution. Ne modifie jamais un montant.',
  })
  @ApiBody({ type: CreateDisputeDto })
  @ApiCreatedResponse({ description: 'Litige créé avec succès.' })
  @ApiConflictResponse({ description: 'Un litige actif existe déjà sur cette distribution.' })
  @ApiBadRequestResponse({ description: 'Payload invalide.' })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Body()
    dto: CreateDisputeDto,
  ) {
    return this.disputesService.create(tenantId, userId, dto);
  }

  @Get()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Lister ses propres litiges',
    description:
      'Litiges de l’employé authentifié uniquement, avec statut et réponse du gestionnaire.',
  })
  @ApiOkResponse({ description: 'Liste retournée avec succès.' })
  async listMine(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,
  ) {
    return this.disputesService.listMine(tenantId, userId);
  }

  @Patch(':id/withdraw')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Retirer un de ses litiges',
    description:
      'Possible uniquement tant que le litige est OPEN. Dès la prise en charge (IN_REVIEW), le retrait est bloqué. Pas de réouverture en V1.',
  })
  @ApiOkResponse({ description: 'Litige retiré avec succès.' })
  @ApiBadRequestResponse({
    description: 'Transition invalide (litige déjà pris en charge ou clos).',
  })
  async withdraw(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.disputesService.withdraw(tenantId, userId, id);
  }
}
