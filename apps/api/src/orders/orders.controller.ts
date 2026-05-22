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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour cette opération.',
})
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une commande',
    description:
      'Crée une commande pour le tenant courant. Les prix, taxes et totaux sont calculés côté backend.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({
    description: 'Commande créée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Shift fermé, serveur non assigné, table invalide ou items invalides.',
  })
  @ApiNotFoundResponse({
    description: 'Shift introuvable.',
  })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Body()
    dto: CreateOrderDto,
  ) {
    return this.ordersService.create(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Lister les commandes',
    description: 'Liste les commandes du tenant courant avec filtres optionnels et pagination.',
  })
  @ApiOkResponse({
    description: 'Liste récupérée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Filtres invalides.',
  })
  async findAll(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Query()
    query: FindOrdersQueryDto,
  ) {
    return this.ordersService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Récupérer une commande par ID',
    description: 'Récupère une commande appartenant au tenant courant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la commande.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiOkResponse({
    description: 'Commande trouvée.',
  })
  @ApiNotFoundResponse({
    description: 'Commande introuvable.',
  })
  async findOne(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.ordersService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Modifier une commande ouverte',
    description: 'Modifie uniquement les champs simples autorisés sur une commande ouverte.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la commande.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiBody({ type: UpdateOrderDto })
  @ApiOkResponse({
    description: 'Commande modifiée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Commande non ouverte ou payload invalide.',
  })
  @ApiNotFoundResponse({
    description: 'Commande introuvable.',
  })
  async update(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,

    @Body()
    dto: UpdateOrderDto,
  ) {
    return this.ordersService.update(tenantId, id, dto);
  }

  @Post(':id/pay')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payer une commande',
    description:
      'Marque une commande comme payée. Opération financière réservée aux rôles de gestion.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de la commande.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiOkResponse({
    description: 'Commande payée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Commande non payable.',
  })
  @ApiNotFoundResponse({
    description: 'Commande introuvable.',
  })
  async payOrder(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.ordersService.payOrder(tenantId, id);
  }
}
