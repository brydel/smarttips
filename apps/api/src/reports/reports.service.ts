import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, Prisma } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import * as PdfMakePrinterModule from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { TipPoolQueryDto } from './dto/tip-pool-query.dto';
import { parseDateOnlyUtc } from './validators/date-range.validator';

type CsvPrimitive = string | number | boolean | null;

type PayrollCsvRow = {
  employee_id: string;
  employee_number: string;
  employee_name: string;
  role: string;
  period_start: string;
  period_end: string;
  shift_date: string;
  hours_worked: string;
  tips_total: string;
  hourly_wage: string;
  gross_total: string;
};

type AuditCsvRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  ip_address: string;
  request_id: string;
  created_at: string;
};

const CSV_FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r\n]/;
const NULL_BYTE = String.fromCharCode(0);

const PDF_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

type PdfKitDocument = NodeJS.ReadableStream & {
  end: () => void;
};

type PdfPrinterInstance = {
  createPdfKitDocument: (docDefinition: TDocumentDefinitions) => PdfKitDocument;
};

type PdfPrinterConstructor = new (fonts: typeof PDF_FONTS) => PdfPrinterInstance;

const PdfPrinter = PdfMakePrinterModule as unknown as PdfPrinterConstructor;
@Injectable()
export class ReportsService {
  private readonly pdfPrinter = new PdfPrinter(PDF_FONTS);

  constructor(private readonly prisma: PrismaService) {}

  async generatePayrollCsv(tenantId: string, dto: PayrollQueryDto): Promise<Buffer> {
    const { from, to } = this.toDateOnlyRange(dto.from, dto.to);

    const fromDate = this.startOfUtcDate(from);
    const toDate = this.endOfUtcDate(to);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: AssignmentStatus.COMPLETED,
        hoursWorked: {
          not: null,
        },
        shift: {
          tenantId,
          deletedAt: null,
          date: {
            gte: fromDate,
            lte: toDate,
          },
        },
        employee: {
          tenantId,
          deletedAt: null,
        },
      },
      select: {
        employeeId: true,
        hoursWorked: true,
        shift: {
          select: {
            date: true,
            tipPool: {
              select: {
                distributions: {
                  where: {
                    tenantId,
                    deletedAt: null,
                  },
                  select: {
                    employeeId: true,
                    amount: true,
                  },
                },
              },
            },
          },
        },
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            role: true,
            hourlyWage: true,
          },
        },
      },
      orderBy: [
        {
          shift: {
            date: 'asc',
          },
        },
        {
          employee: {
            lastName: 'asc',
          },
        },
        {
          employee: {
            firstName: 'asc',
          },
        },
      ],
    });

    const rows: PayrollCsvRow[] = assignments.map((assignment) => {
      const hoursWorked = this.requiredDecimal(assignment.hoursWorked, 'hoursWorked');

      const hourlyWage = this.decimalOrZero(assignment.employee.hourlyWage);

      const tipDistributionAmount =
        assignment.shift.tipPool?.distributions.find(
          (distribution) => distribution.employeeId === assignment.employeeId,
        )?.amount ?? new Prisma.Decimal(0);

      const wageTotal = hourlyWage.mul(hoursWorked);
      const grossTotal = wageTotal.add(tipDistributionAmount);

      return {
        employee_id: assignment.employeeId,
        employee_number: this.safeText(assignment.employee.employeeNumber ?? ''),
        employee_name: this.safeText(
          this.formatEmployeeName(assignment.employee.firstName, assignment.employee.lastName),
        ),
        role: this.safeText(assignment.employee.role),
        period_start: dto.from,
        period_end: dto.to,
        shift_date: this.formatDateOnly(assignment.shift.date),
        hours_worked: this.formatDecimal(hoursWorked),
        tips_total: this.formatDecimal(tipDistributionAmount),
        hourly_wage: this.formatDecimal(hourlyWage),
        gross_total: this.formatDecimal(grossTotal),
      };
    });

    return this.buildCsvBuffer(rows);
  }

  async generateTipPoolPdf(tenantId: string, dto: TipPoolQueryDto): Promise<Buffer> {
    const shift = await this.prisma.shift.findFirst({
      where: {
        id: dto.shiftId,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        date: true,
        shiftType: true,
        status: true,
        tipPool: {
          select: {
            cashAmount: true,
            cardAmount: true,
            totalAmount: true,
            declaredAt: true,
            status: true,
            distributions: {
              where: {
                tenantId,
                deletedAt: null,
              },
              select: {
                amount: true,
                computationMethod: true,
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    role: true,
                  },
                },
              },
              orderBy: {
                amount: 'desc',
              },
            },
          },
        },
      },
    });

    if (shift === null) {
      throw new NotFoundException('error.reports.shift.notFound');
    }

    if (shift.tipPool === null) {
      throw new NotFoundException('error.reports.tipPool.notFound');
    }

    const distributionRows: TableCell[][] =
      shift.tipPool.distributions.length === 0
        ? [
            [
              {
                text: 'No distribution found for this shift.',
                colSpan: 4,
                italics: true,
              },
              {},
              {},
              {},
            ],
          ]
        : shift.tipPool.distributions.map((distribution) => [
            this.safePdfText(
              this.formatEmployeeName(
                distribution.employee.firstName,
                distribution.employee.lastName,
              ),
            ),
            this.safePdfText(distribution.employee.role),
            this.safePdfText(distribution.computationMethod),
            `$${this.formatDecimal(distribution.amount)}`,
          ]);

    const content: Content[] = [
      {
        text: 'SmartTips — Tip Pool Report',
        style: 'header',
      },
      {
        columns: [
          {
            width: '*',
            text: [
              { text: 'Shift ID: ', bold: true },
              this.safePdfText(shift.id),
              '\n',
              { text: 'Date: ', bold: true },
              this.formatDateOnly(shift.date),
              '\n',
              { text: 'Shift type: ', bold: true },
              this.safePdfText(shift.shiftType),
              '\n',
              { text: 'Shift status: ', bold: true },
              this.safePdfText(shift.status),
            ],
          },
          {
            width: '*',
            text: [
              { text: 'Tip pool status: ', bold: true },
              this.safePdfText(shift.tipPool.status),
              '\n',
              { text: 'Declared at: ', bold: true },
              shift.tipPool.declaredAt.toISOString(),
              '\n',
              { text: 'Cash: ', bold: true },
              `$${this.formatDecimal(shift.tipPool.cashAmount)}`,
              '\n',
              { text: 'Card: ', bold: true },
              `$${this.formatDecimal(shift.tipPool.cardAmount)}`,
              '\n',
              { text: 'Total: ', bold: true },
              `$${this.formatDecimal(shift.tipPool.totalAmount)}`,
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Employee', bold: true },
              { text: 'Role', bold: true },
              { text: 'Method', bold: true },
              { text: 'Amount', bold: true },
            ],
            ...distributionRows,
          ],
        },
      },
      {
        text: `Generated at: ${new Date().toISOString()}`,
        style: 'footer',
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
      },
      content,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 12],
        },
        footer: {
          fontSize: 8,
          margin: [0, 16, 0, 0],
        },
      },
      pageMargins: [40, 40, 40, 40],
      info: {
        title: `SmartTips Tip Pool Report ${this.formatDateOnly(shift.date)}`,
        author: 'SmartTips',
        subject: 'Tip pool report',
        keywords: 'tips,payroll,compliance,SmartTips',
      },
    };

    return this.buildPdfBuffer(docDefinition);
  }

  async generateAuditCsv(tenantId: string, dto: AuditQueryDto): Promise<Buffer> {
    const { from, to } = this.toDateOnlyRange(dto.from, dto.to);

    const fromDate = this.startOfUtcDate(from);
    const toDate = this.endOfUtcDate(to);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        ipAddress: true,
        requestId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const rows: AuditCsvRow[] = logs.map((log) => ({
      id: log.id,
      action: this.safeText(log.action),
      entity_type: this.safeText(log.entityType),
      entity_id: log.entityId,
      user_id: log.userId ?? '',
      ip_address: this.safeText(log.ipAddress?.toString() ?? ''),
      request_id: this.safeText(log.requestId ?? ''),
      created_at: log.createdAt.toISOString(),
    }));

    return this.buildCsvBuffer(rows);
  }

  private buildCsvBuffer<T extends Record<string, CsvPrimitive>>(rows: T[]): Buffer {
    const csv = stringify(rows, {
      header: true,
      quoted: true,
      bom: true,
      record_delimiter: 'unix',
    });

    return Buffer.from(csv, 'utf8');
  }

  private buildPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdfDocument = this.pdfPrinter.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];

      pdfDocument.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      pdfDocument.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      pdfDocument.on('error', (error: Error) => {
        reject(error);
      });

      pdfDocument.end();
    });
  }

  private toDateOnlyRange(fromRaw: string, toRaw: string): { from: Date; to: Date } {
    const from = parseDateOnlyUtc(fromRaw);
    const to = parseDateOnlyUtc(toRaw);

    if (from === null || to === null) {
      throw new BadRequestException('error.validation.dateOnly.invalid');
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('error.validation.dateRange.invalid');
    }

    return { from, to };
  }

  private startOfUtcDate(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private endOfUtcDate(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
    );
  }

  private formatEmployeeName(firstName: string, lastName: string): string {
    return `${firstName.trim()} ${lastName.trim()}`.trim();
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatDecimal(value: Prisma.Decimal): string {
    return value.toDecimalPlaces(2).toFixed(2);
  }

  private decimalOrZero(value: Prisma.Decimal | null | undefined): Prisma.Decimal {
    return value ?? new Prisma.Decimal(0);
  }

  private requiredDecimal(value: Prisma.Decimal | null, fieldName: string): Prisma.Decimal {
    if (value === null) {
      throw new BadRequestException(`error.reports.requiredDecimalMissing.${fieldName}`);
    }

    return value;
  }

  private safeText(value: string): string {
    const normalized = value.split(NULL_BYTE).join('').trim();

    if (CSV_FORMULA_PREFIX_PATTERN.test(normalized)) {
      return `'${normalized}`;
    }

    return normalized;
  }

  private safePdfText(value: string): string {
    return value.split(NULL_BYTE).join('').trim();
  }
}
