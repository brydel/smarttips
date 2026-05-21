import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { FilterMenuItemsDto } from './dto/filter-menu-items.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Menu Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un item du menu' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Item créé avec succès.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Un item avec ce nom existe déjà.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Le coût dépasse le prix.' })
  async create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateMenuItemDto) {
    return this.menuItemsService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Lister les items du menu' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Liste récupérée.' })
  async findAll(@CurrentUser('tenantId') tenantId: string, @Query() filters: FilterMenuItemsDto) {
    return this.menuItemsService.findAll(tenantId, filters.categoryId, filters.active);
  }

  @Get('categories')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Lister les catégories distinctes' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Catégories récupérées.' })
  async findCategories(@CurrentUser('tenantId') tenantId: string) {
    return this.menuItemsService.findCategories(tenantId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Récupérer un item par ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item trouvé.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item introuvable.' })
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.menuItemsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un item' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item mis à jour.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Item introuvable.' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Un item avec ce nom existe déjà.' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Le coût dépasse le prix, ou catégorie invalide.',
  })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuItemsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer (soft delete) un item' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Item supprimé.' })
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.menuItemsService.remove(tenantId, id);
  }
}
