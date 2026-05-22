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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TipPoolsService } from './tip-pools.service';
import { CreateTipPoolDto } from './dto/create-tip-pool.dto';
import { UpdateTipPoolDto } from './dto/update-tip-pool.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Tip Pools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour accéder aux pools de pourboires.',
})
@Controller('tip-pools')
export class TipPoolsController {
  constructor(private readonly tipPoolsService: TipPoolsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Déclarer un pool de pourboires',
    description:
      'Crée un pool de pourboires pour un shift clôturé. Le total est calculé côté backend avec cashAmount + cardAmount.',
  })
  @ApiBody({ type: CreateTipPoolDto })
  @ApiCreatedResponse({
    description: 'Pool de pourboires créé avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Shift non clôturé ou montant total invalide.',
  })
  @ApiConflictResponse({
    description: 'Un pool existe déjà pour ce shift.',
  })
  @ApiNotFoundResponse({
    description: 'Shift introuvable.',
  })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Body()
    dto: CreateTipPoolDto,
  ) {
    return this.tipPoolsService.create(tenantId, userId, dto);
  }

  @Get('shift/:shiftId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Récupérer le pool d’un shift',
    description: 'Récupère le pool de pourboires associé à un shift du tenant courant.',
  })
  @ApiParam({
    name: 'shiftId',
    description: 'UUID v4 du shift.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiOkResponse({
    description: 'Pool trouvé.',
  })
  @ApiNotFoundResponse({
    description: 'Pool introuvable pour ce shift.',
  })
  async findByShift(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('shiftId', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,
  ) {
    return this.tipPoolsService.findByShift(tenantId, shiftId);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Modifier un pool déclaré',
    description:
      'Permet de corriger cashAmount, cardAmount ou notes tant que le pool est encore au statut DECLARED.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du pool de pourboires.',
    example: '7a9cdd21-8c8d-4f6a-930d-331cfa3ac57b',
  })
  @ApiBody({ type: UpdateTipPoolDto })
  @ApiOkResponse({
    description: 'Pool modifié avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Pool verrouillé, update vide ou montant total invalide.',
  })
  @ApiNotFoundResponse({
    description: 'Pool introuvable.',
  })
  async update(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,

    @Body()
    dto: UpdateTipPoolDto,
  ) {
    return this.tipPoolsService.update(tenantId, id, dto);
  }

  @Post(':id/distribute')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déclencher la distribution du pool',
    description:
      'Déclenche la distribution du pool de pourboires. Cette opération doit être transactionnelle et non rejouable.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du pool de pourboires.',
    example: '7a9cdd21-8c8d-4f6a-930d-331cfa3ac57b',
  })
  @ApiOkResponse({
    description: 'Pool distribué avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Pool déjà distribué, montant invalide ou aucune assignation éligible.',
  })
  @ApiNotFoundResponse({
    description: 'Pool introuvable.',
  })
  async distribute(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.tipPoolsService.distribute(tenantId, id);
  }
}
