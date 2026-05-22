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
  Query,
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { FindShiftsQueryDto } from './dto/find-shifts-query.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({
  description: 'JWT manquant, expiré ou invalide.',
})
@ApiForbiddenResponse({
  description: 'Rôle insuffisant pour accéder à cette ressource.',
})
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un shift',
    description:
      'Crée un shift pour le tenant courant. Le tenantId doit toujours venir du JWT, jamais du body.',
  })
  @ApiBody({ type: CreateShiftDto })
  @ApiCreatedResponse({
    description: 'Shift créé avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide ou endTime inférieur/égal à startTime.',
  })
  async create(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Body()
    dto: CreateShiftDto,
  ) {
    return this.shiftsService.create(tenantId, userId, dto);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Lister les shifts',
    description:
      'Liste les shifts du tenant courant. Un employé ne doit voir que ce que le service l’autorise à voir.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Date ISO au format YYYY-MM-DD.',
    example: '2026-05-21',
  })
  @ApiOkResponse({
    description: 'Liste des shifts récupérée avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Query params invalides.',
  })
  async findAll(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Query()
    query: FindShiftsQueryDto,
  ) {
    return this.shiftsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: 'Récupérer un shift par ID',
    description:
      'Récupère un shift appartenant au tenant courant. Le service doit vérifier tenantId + shiftId ensemble.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: '2f3f1e7a-6f3d-4e4e-9a92-173fd84b9f42',
  })
  @ApiOkResponse({
    description: 'Shift trouvé.',
  })
  @ApiNotFoundResponse({
    description: 'Shift introuvable pour ce tenant.',
  })
  async findOne(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,
  ) {
    return this.shiftsService.findOne(tenantId, shiftId);
  }

  @Post(':id/assignments')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assigner un employé à un shift',
    description:
      'Assigne un employé au shift du tenant courant. Le service doit vérifier que le shift et l’employé appartiennent au même tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: '2f3f1e7a-6f3d-4e4e-9a92-173fd84b9f42',
  })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiCreatedResponse({
    description: 'Employé assigné avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide ou employé non assignable.',
  })
  @ApiConflictResponse({
    description: 'Employé déjà assigné à ce shift.',
  })
  @ApiNotFoundResponse({
    description: 'Shift ou employé introuvable pour ce tenant.',
  })
  async addAssignment(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,

    @Body()
    dto: CreateAssignmentDto,
  ) {
    return this.shiftsService.addAssignment(tenantId, shiftId, dto);
  }

  @Patch(':id/assignments/:employeeId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Modifier une assignation de shift',
    description:
      'Modifie les heures travaillées ou les informations autorisées sur une assignation existante.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: '2f3f1e7a-6f3d-4e4e-9a92-173fd84b9f42',
  })
  @ApiParam({
    name: 'employeeId',
    description: 'UUID v4 de l’employé assigné.',
    example: '8dfdb4e4-089f-4477-8e17-f3ffb320a1f8',
  })
  @ApiBody({ type: UpdateAssignmentDto })
  @ApiOkResponse({
    description: 'Assignation mise à jour avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Payload invalide.',
  })
  @ApiNotFoundResponse({
    description: 'Assignation introuvable pour ce tenant.',
  })
  async updateAssignment(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,

    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,

    @Body()
    dto: UpdateAssignmentDto,
  ) {
    return this.shiftsService.updateAssignment(tenantId, shiftId, employeeId, dto);
  }

  @Delete(':id/assignments/:employeeId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Retirer un employé d’un shift',
    description: 'Supprime l’assignation d’un employé à un shift du tenant courant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: '2f3f1e7a-6f3d-4e4e-9a92-173fd84b9f42',
  })
  @ApiParam({
    name: 'employeeId',
    description: 'UUID v4 de l’employé.',
    example: '8dfdb4e4-089f-4477-8e17-f3ffb320a1f8',
  })
  @ApiNoContentResponse({
    description: 'Employé retiré du shift avec succès.',
  })
  @ApiNotFoundResponse({
    description: 'Assignation introuvable pour ce tenant.',
  })
  async removeAssignment(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,

    @Param('employeeId', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
  ): Promise<void> {
    await this.shiftsService.removeAssignment(tenantId, shiftId, employeeId);
  }

  @Post(':id/close')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clôturer un shift',
    description:
      'Clôture un shift du tenant courant. Cette opération doit être transactionnelle et protégée contre les doubles exécutions.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 du shift.',
    example: '2f3f1e7a-6f3d-4e4e-9a92-173fd84b9f42',
  })
  @ApiOkResponse({
    description: 'Shift clôturé avec succès.',
  })
  @ApiBadRequestResponse({
    description: 'Shift déjà clôturé, invalide ou sans assignation.',
  })
  @ApiNotFoundResponse({
    description: 'Shift introuvable pour ce tenant.',
  })
  async closeShift(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @CurrentUser('id', new ParseUUIDPipe({ version: '4' }))
    userId: string,

    @Param('id', new ParseUUIDPipe({ version: '4' }))
    shiftId: string,
  ) {
    return this.shiftsService.closeShift(tenantId, userId, shiftId);
  }
}
