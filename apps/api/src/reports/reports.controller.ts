import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../auth/enums/user-role.enum';
import type { Request, Response } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { AuditQueryDto } from './dto/audit-query.dto';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { TipPoolQueryDto } from './dto/tip-pool-query.dto';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & {
  user: {
    tenantId: string;
    sub?: string;
    id?: string;
    role?: string;
  };
};

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('payroll')
  @ApiOperation({
    summary: 'Export payroll report as CSV',
    description:
      'Exports completed shift assignments and calculated payroll totals for a validated date range.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Payroll CSV file generated successfully.',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Header('X-Content-Type-Options', 'nosniff')
  async getPayrollCsv(
    @Query() dto: PayrollQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.generatePayrollCsv(req.user.tenantId, dto);

    const filename = this.safeDownloadFilename(`payroll_${dto.from}_${dto.to}.csv`);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return new StreamableFile(buffer);
  }

  @Get('tip-pool')
  @ApiOperation({
    summary: 'Export tip pool report as PDF',
    description: 'Exports a PDF summary of a single shift tip pool and its distributions.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Tip pool PDF file generated successfully.',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Header('X-Content-Type-Options', 'nosniff')
  async getTipPoolPdf(
    @Query() dto: TipPoolQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateTipPoolPdf(req.user.tenantId, dto);

    const filename = this.safeDownloadFilename(`tippool_${dto.shiftId}.pdf`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return new StreamableFile(buffer);
  }

  @Get('audit')
  @ApiOperation({
    summary: 'Export audit trail as CSV',
    description:
      'Exports audit trail metadata for a validated date range. Sensitive payload fields are intentionally excluded.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'Audit CSV file generated successfully.',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Header('X-Content-Type-Options', 'nosniff')
  async getAuditCsv(
    @Query() dto: AuditQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.reportsService.generateAuditCsv(req.user.tenantId, dto);

    const filename = this.safeDownloadFilename(`audit_${dto.from}_${dto.to}.csv`);

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return new StreamableFile(buffer);
  }

  private safeDownloadFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
