import {
  Body,
  Controller,
  Delete,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Menu Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour cette opération.',
})
@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuCategoriesService: MenuCategoriesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une catégorie',
    description:
      'Crée une catégorie de menu pour le tenant courant. Le nom doit être unique parmi les catégories actives du tenant.',
  })
  @ApiBody({ type: CreateMenuCategoryDto })
  @ApiCreatedResponse({
    description: 'Catégorie créée avec succès.',
  })
  @ApiConflictResponse({
    description: 'Nom déjà utilisé par une catégorie active.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide.',
  })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Body()
    dto: CreateMenuCategoryDto,
  ) {
    return this.menuCategoriesService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Lister les catégories',
    description: 'Liste les catégories actives et non supprimées du tenant courant.',
  })
  @ApiOkResponse({
    description: 'Liste récupérée avec succès.',
  })
  async findAll(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,
  ) {
    return this.menuCategoriesService.findAll(tenantId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Récupérer une catégorie par ID',
    description: 'Récupère une catégorie appartenant au tenant courant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la catégorie.',
    example: '7a9cdd21-8c8d-4f6a-930d-331cfa3ac57b',
  })
  @ApiOkResponse({
    description: 'Catégorie trouvée.',
  })
  @ApiNotFoundResponse({
    description: 'Catégorie introuvable.',
  })
  async findOne(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.menuCategoriesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Modifier une catégorie',
    description:
      'Modifie une catégorie active du tenant courant. Un update vide doit être refusé par le service.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la catégorie.',
    example: '7a9cdd21-8c8d-4f6a-930d-331cfa3ac57b',
  })
  @ApiBody({ type: UpdateMenuCategoryDto })
  @ApiOkResponse({
    description: 'Catégorie modifiée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide ou update vide.',
  })
  @ApiNotFoundResponse({
    description: 'Catégorie introuvable.',
  })
  @ApiConflictResponse({
    description: 'Nom déjà utilisé par une catégorie active.',
  })
  async update(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,

    @Body()
    dto: UpdateMenuCategoryDto,
  ) {
    return this.menuCategoriesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer une catégorie',
    description: 'Effectue un soft delete de la catégorie si elle ne contient aucun item actif.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la catégorie.',
    example: '7a9cdd21-8c8d-4f6a-930d-331cfa3ac57b',
  })
  @ApiNoContentResponse({
    description: 'Catégorie supprimée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'La catégorie contient encore des items actifs.',
  })
  @ApiNotFoundResponse({
    description: 'Catégorie introuvable.',
  })
  async remove(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<void> {
    await this.menuCategoriesService.remove(tenantId, id);
  }
}
