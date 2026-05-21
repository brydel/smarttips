import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, EmployeeRole } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouvel employé' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Employé créé avec succès.' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Un employé avec cet email existe déjà.',
  })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(tenantId, createEmployeeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les employés du restaurant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Liste récupérée.' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('role') role?: EmployeeRole,
    @Query('active') active?: string,
  ) {
    let isActive: boolean | undefined;

    if (active !== undefined) {
      if (active !== 'true' && active !== 'false') {
        throw new BadRequestException('error.validation.active.invalid');
      }
      isActive = active === 'true';
    }

    return this.employeesService.findAll(tenantId, role, isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer les détails d'un employé" })
  @ApiResponse({ status: HttpStatus.OK, description: 'Employé trouvé.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Employé introuvable.' })
  async findOne(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.employeesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Mettre à jour le profil d'un employé" })
  @ApiResponse({ status: HttpStatus.OK, description: 'Employé mis à jour.' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(tenantId, id, updateEmployeeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver (soft delete) un employé' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Employé supprimé.' })
  async remove(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.employeesService.remove(tenantId, id);
  }
}
