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

import { ActionInboxService } from './action-inbox.service';
import { ActionInboxDetectorsService } from './action-inbox-detectors.service';
import { ListActionItemsDto } from './dto/list-action-items.dto';
import { UpdateActionItemStatusDto } from './dto/update-action-item-status.dto';

import { UserRole } from '../auth/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Action Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant : réservé aux OWNER et MANAGER.',
})
@Controller('action-inbox')
export class ActionInboxController {
  constructor(
    private readonly actionInboxService: ActionInboxService,
    private readonly detectorsService: ActionInboxDetectorsService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Lister les actions de la boîte manager',
    description:
      'Retourne les actions du tenant, filtrables par statut, sévérité, type et shift. Tri : sévérité décroissante puis plus récent.',
  })
  @ApiOkResponse({ description: 'Liste paginée retournée avec succès.' })
  async list(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Query()
    dto: ListActionItemsDto,
  ) {
    return this.actionInboxService.list(tenantId, dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Exécuter les détecteurs de la boîte d’actions',
    description:
      'Dérive les actions depuis les données réelles du tenant (shifts, pools, assignations). Idempotent : aucun doublon, les items ignorés ne sont jamais réouverts.',
  })
  @ApiOkResponse({ description: 'Résumé du rafraîchissement : created, autoResolved, open.' })
  async refresh(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,
  ) {
    return this.detectorsService.refresh(tenantId, userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Résoudre ou ignorer une action',
    description: 'Transition manuelle OPEN → RESOLVED ou DISMISSED, avec note optionnelle.',
  })
  @ApiBody({ type: UpdateActionItemStatusDto })
  @ApiOkResponse({ description: 'Action mise à jour avec succès.' })
  @ApiBadRequestResponse({ description: 'Transition invalide ou payload invalide.' })
  @ApiNotFoundResponse({ description: 'Action introuvable pour ce tenant.' })
  async updateStatus(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,

    @Body()
    dto: UpdateActionItemStatusDto,
  ) {
    return this.actionInboxService.updateStatus(tenantId, userId, id, dto);
  }
}
