import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DistributionService } from './distribution.service';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Distribution')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour cette opération.',
})
@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  @Post(':id/distribute')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Distribuer les pourboires d’un shift',
    description:
      'Calcule et enregistre les distributions du tip pool associé au shift. Opération financière réservée aux gestionnaires.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiNoContentResponse({
    description: 'Distribution créée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Shift non clôturé, aucun tip pool, pool non déclaré ou données invalides.',
  })
  @ApiConflictResponse({
    description: 'Distribution déjà existante ou distribution concurrente.',
  })
  @ApiNotFoundResponse({
    description: 'Shift ou tip pool introuvable.',
  })
  async distribute(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,

    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,
  ): Promise<void> {
    await this.distributionService.distribute(tenantId, shiftId);
  }

  @Get(':id/distribution')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Récupérer la distribution d’un shift',
    description: 'Retourne les montants distribués aux employés pour le shift donné.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiOkResponse({
    description: 'Distribution récupérée avec succès.',
  })
  @ApiNotFoundResponse({
    description: 'Distribution introuvable.',
  })
  async getDistribution(
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,

    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,
  ) {
    return this.distributionService.getDistribution(tenantId, shiftId);
  }
}
