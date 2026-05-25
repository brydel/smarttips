import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

import { DashboardService } from './dashboard.service';
import { GetStatsQueryDto } from './dto/get-stats-query.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Manager KPI dashboard stats',
    description:
      'Returns aggregated KPIs, charts, top performers, and alerts for the manager dashboard. ' +
      'tenantId is ALWAYS extracted from the JWT — it is never accepted from the query string. ' +
      'Access is restricted to OWNER and MANAGER roles.',
  })
  @ApiOkResponse({ description: 'Dashboard stats for the requested period.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Insufficient role (EMPLOYEE is not allowed).' })
  async getStats(
    @CurrentUser('tenantId', new ParseUUIDPipe({ version: '4' }))
    tenantId: string,

    @Query() query: GetStatsQueryDto,
  ) {
    return this.dashboardService.getStats(tenantId, query.period);
  }
}
