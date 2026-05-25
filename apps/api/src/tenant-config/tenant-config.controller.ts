import { Body, Controller, Get, Patch, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TenantConfigService } from './tenant-config.service';
import { UpdateDistributionConfigDto } from './dto/update-distribution-config.dto';

import { UserRole } from '../auth/enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Tenant Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour cette opération.',
})
@Controller('tenant')
export class TenantConfigController {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Get('distribution-config')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Récupérer la configuration de distribution du tenant',
    description:
      'Retourne la configuration personnalisée du tenant. Si aucune configuration n’existe, retourne les valeurs par défaut.',
  })
  @ApiOkResponse({
    description: 'Configuration retournée avec succès.',
  })
  async getDistributionConfig(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,
  ) {
    return this.tenantConfigService.getDistributionConfig(tenantId);
  }

  @Patch('distribution-config')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Mettre à jour la configuration de distribution',
    description:
      'Permet à un OWNER de personnaliser les règles de distribution du tenant : coefficients par rôle, minimum horaire, plafond, bonus ventes et mode de calcul.',
  })
  @ApiBody({
    type: UpdateDistributionConfigDto,
  })
  @ApiOkResponse({
    description: 'Configuration mise à jour avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide, update vide, mode non disponible ou valeur hors limites.',
  })
  async upsertDistributionConfig(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Body()
    dto: UpdateDistributionConfigDto,
  ) {
    return this.tenantConfigService.upsertDistributionConfig(tenantId, userId, dto);
  }
}
