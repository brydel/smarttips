import {
  Body,
  Controller,
  Delete,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { UserRole } from '../auth/enums/user-role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AcceptEmployeeInvitationDto } from './dto/accept-employee-invitation.dto';
import { CreateEmployeeInvitationDto } from './dto/create-employee-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Envoyer une invitation à un employé',
    description:
      'Crée une invitation sécurisée pour un employé existant sans compte utilisateur, puis envoie un magic link par email.',
  })
  @ApiCreatedResponse({
    description: 'Invitation créée et email envoyé avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide ou employé non éligible.',
  })
  @ApiConflictResponse({
    description: 'Employé déjà lié à un compte, email déjà utilisé ou invitation déjà en attente.',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT manquant, expiré ou invalide.',
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant.',
  })
  @ApiNotFoundResponse({
    description: 'Employé introuvable.',
  })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    invitedBy: string,

    @Body()
    dto: CreateEmployeeInvitationDto,
  ) {
    return this.invitationsService.create(tenantId, invitedBy, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lister les invitations du tenant',
    description:
      'Retourne les invitations employé du restaurant courant. Réservé aux OWNER et MANAGER.',
  })
  @ApiOkResponse({
    description: 'Liste des invitations récupérée avec succès.',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT manquant, expiré ou invalide.',
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant.',
  })
  async findAll(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,
  ) {
    return this.invitationsService.findAll(tenantId);
  }

  @Get(':token/validate')
  @ApiOperation({
    summary: 'Valider un token d’invitation',
    description:
      'Route publique utilisée par la page /invite?token=... pour vérifier si l’invitation est valide avant création du compte.',
  })
  @ApiParam({
    name: 'token',
    description: 'Token opaque reçu par email. Le token brut n’est jamais stocké en DB.',
    example: '9e2c6b1d2f5a7c8e0a4b6f8d1c3e5a7b9d0f2c4e6a8b1d3f5c7e9a0b2d4f6a8c',
  })
  @ApiOkResponse({
    description: 'Invitation valide.',
  })
  @ApiNotFoundResponse({
    description: 'Token invalide ou invitation inexistante.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invitation expirée ou employé non éligible.',
  })
  async validate(
    @Param('token')
    token: string,
  ) {
    return this.invitationsService.validate(token);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accepter une invitation et créer son compte',
    description:
      'Route publique utilisée par un employé invité pour créer son compte. Si l’acceptation réussit, le backend retourne un access token.',
  })
  @ApiParam({
    name: 'token',
    description: 'Token opaque reçu par email.',
  })
  @ApiOkResponse({
    description: 'Invitation acceptée, compte créé et JWT retourné.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide.',
  })
  @ApiConflictResponse({
    description: 'Email déjà utilisé ou invitation déjà acceptée.',
  })
  @ApiNotFoundResponse({
    description: 'Token invalide ou invitation inexistante.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invitation expirée ou employé non éligible.',
  })
  async accept(
    @Param('token')
    token: string,

    @Body()
    dto: AcceptEmployeeInvitationDto,
  ) {
    return this.invitationsService.accept(token, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Révoquer une invitation',
    description: 'Révoque une invitation en attente. Réservé au OWNER.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 de l’invitation à révoquer.',
    example: 'f15dfc77-72fb-4586-9f36-672cfb76f69b',
  })
  @ApiNoContentResponse({
    description: 'Invitation révoquée avec succès.',
  })
  @ApiNotFoundResponse({
    description: 'Invitation introuvable.',
  })
  @ApiConflictResponse({
    description: 'Invitation déjà acceptée, expirée ou révoquée.',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT manquant, expiré ou invalide.',
  })
  @ApiForbiddenResponse({
    description: 'Rôle insuffisant.',
  })
  async revoke(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ): Promise<void> {
    await this.invitationsService.revoke(tenantId, id);
  }
}
