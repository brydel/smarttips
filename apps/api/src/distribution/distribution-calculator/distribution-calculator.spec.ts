import { BadRequestException } from '@nestjs/common';
import { ComputationMethod, EmployeeRole, Prisma } from '@prisma/client';

import { DistributionCalculatorService } from './distribution-calculator.service';
import { DistributionConfig, DistributionInput, EmployeeShiftInput } from '../distribution.types';
import { toDecimal } from './money';

const DEFAULT_CONFIG: DistributionConfig = {
  roleCoefficients: {
    [EmployeeRole.SERVER]: toDecimal(1.0),
    [EmployeeRole.BARTENDER]: toDecimal(0.9),
    [EmployeeRole.BUSSER]: toDecimal(0.7),
    [EmployeeRole.HOST]: toDecimal(0.6),
    [EmployeeRole.COOK]: toDecimal(0.5),
    [EmployeeRole.CHEF]: toDecimal(0.8),
  },
  minimumPerHour: toDecimal(2),
  maxSharePercent: toDecimal(35),
  salesBonusWeight: toDecimal(0.5),
};

function makeEmployee(
  overrides: Partial<EmployeeShiftInput> & { employeeId: string },
): EmployeeShiftInput {
  return {
    role: EmployeeRole.SERVER,
    hoursWorked: toDecimal(8),
    salesGenerated: toDecimal(500),
    coefficient: toDecimal(1),
    ...overrides,
  };
}

function makeInput(
  employees: EmployeeShiftInput[],
  poolTotal: number,
  config?: Partial<DistributionConfig>,
): DistributionInput {
  return {
    tenantId: 'tenant-uuid-001',
    shiftId: 'shift-uuid-001',
    tipPoolId: 'pool-uuid-001',
    totalAmount: toDecimal(poolTotal),
    config: {
      ...DEFAULT_CONFIG,
      ...config,
    },
    employees,
    computationMethod: ComputationMethod.RULES,
  };
}

function sumAmounts(results: { amount: Prisma.Decimal }[]): Prisma.Decimal {
  return results.reduce((acc, result) => acc.add(result.amount), toDecimal(0));
}

describe('DistributionCalculatorService', () => {
  let service: DistributionCalculatorService;

  beforeEach(() => {
    service = new DistributionCalculatorService();
  });

  describe('pool integrity', () => {
    it('la somme des distributions doit égaler le pool total', () => {
      const input = makeInput(
        [
          makeEmployee({
            employeeId: 'e1',
            salesGenerated: toDecimal(800),
          }),
          makeEmployee({
            employeeId: 'e2',
            salesGenerated: toDecimal(400),
          }),
          makeEmployee({
            employeeId: 'e3',
            role: EmployeeRole.BUSSER,
            salesGenerated: toDecimal(0),
          }),
        ],
        500,
      );

      const result = service.compute(input);

      expect(sumAmounts(result.results).toFixed(2)).toBe('500.00');
      expect(result.remainderCents).toBe(0);
    });

    it('pool non divisible également — somme reste exacte', () => {
      const input = makeInput(
        [
          makeEmployee({ employeeId: 'e1' }),
          makeEmployee({ employeeId: 'e2' }),
          makeEmployee({ employeeId: 'e3' }),
        ],
        100,
      );

      const result = service.compute(input);

      expect(sumAmounts(result.results).toFixed(2)).toBe('100.00');
      expect(result.remainderCents).toBe(0);
    });
  });

  describe('1 seul employé', () => {
    it('reçoit 100% du pool si le plafond autorise 100%', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 300, {
        maxSharePercent: toDecimal(100),
      });

      const result = service.compute(input);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].amount.toFixed(2)).toBe('300.00');
      expect(sumAmounts(result.results).toFixed(2)).toBe('300.00');
    });

    it('throw si le plafond rend la distribution impossible', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 300, {
        maxSharePercent: toDecimal(35),
      });

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });
  });

  describe('rôles non-vendeurs', () => {
    it('BUSSER avec salesGenerated=0 — salesBonus=1', () => {
      const input = makeInput(
        [
          makeEmployee({
            employeeId: 'e1',
            role: EmployeeRole.SERVER,
            hoursWorked: toDecimal(8),
            salesGenerated: toDecimal(600),
          }),
          makeEmployee({
            employeeId: 'e2',
            role: EmployeeRole.BUSSER,
            hoursWorked: toDecimal(8),
            salesGenerated: toDecimal(0),
          }),
        ],
        200,
        { maxSharePercent: toDecimal(100) },
      );

      const result = service.compute(input);
      const busser = result.results.find((r) => r.employeeId === 'e2');

      expect(busser).toBeDefined();
      expect(busser!.explanation.salesBonus).toBe('1.0000');
      expect(busser!.amount.gt(0)).toBe(true);
    });

    it("COOK et HOST reçoivent moins qu'un SERVER à heures égales", () => {
      const input = makeInput(
        [
          makeEmployee({
            employeeId: 'e1',
            role: EmployeeRole.SERVER,
            salesGenerated: toDecimal(0),
          }),
          makeEmployee({
            employeeId: 'e2',
            role: EmployeeRole.COOK,
            salesGenerated: toDecimal(0),
          }),
          makeEmployee({
            employeeId: 'e3',
            role: EmployeeRole.HOST,
            salesGenerated: toDecimal(0),
          }),
        ],
        300,
      );

      const result = service.compute(input);
      const server = result.results.find((r) => r.employeeId === 'e1');
      const cook = result.results.find((r) => r.employeeId === 'e2');
      const host = result.results.find((r) => r.employeeId === 'e3');

      expect(server).toBeDefined();
      expect(cook).toBeDefined();
      expect(host).toBeDefined();

      expect(server!.amount.gt(host!.amount)).toBe(true);
      expect(host!.amount.gt(cook!.amount)).toBe(true);
    });
  });

  describe('plafond maxSharePercent', () => {
    it('un employé dominant est plafonné et le surplus est redistribué', () => {
      const input = makeInput(
        [
          makeEmployee({
            employeeId: 'e1',
            hoursWorked: toDecimal(40),
            salesGenerated: toDecimal(5000),
          }),
          makeEmployee({
            employeeId: 'e2',
            hoursWorked: toDecimal(4),
            salesGenerated: toDecimal(100),
          }),
          makeEmployee({
            employeeId: 'e3',
            hoursWorked: toDecimal(4),
            salesGenerated: toDecimal(100),
          }),
        ],
        1000,
      );

      const result = service.compute(input);
      const top = result.results.find((r) => r.employeeId === 'e1');

      expect(top).toBeDefined();
      expect(top!.amount.lte(toDecimal(350))).toBe(true);
      expect(top!.explanation.capApplied).toBe(true);
      expect(sumAmounts(result.results).toFixed(2)).toBe('1000.00');
    });

    it('throw si le plafond empêche mathématiquement de distribuer tout le pool', () => {
      const input = makeInput(
        [makeEmployee({ employeeId: 'e1' }), makeEmployee({ employeeId: 'e2' })],
        100,
        { maxSharePercent: toDecimal(35) },
      );

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });
  });

  describe('minimum garanti minimumPerHour', () => {
    it('un employé sous le minimum est ajusté à la hausse', () => {
      const input = makeInput(
        [
          makeEmployee({
            employeeId: 'e1',
            hoursWorked: toDecimal(8),
            salesGenerated: toDecimal(5000),
          }),
          makeEmployee({
            employeeId: 'e2',
            hoursWorked: toDecimal(1),
            salesGenerated: toDecimal(0),
            role: EmployeeRole.BUSSER,
            coefficient: toDecimal(0.01),
          }),
        ],
        500,
        { maxSharePercent: toDecimal(100) },
      );

      const result = service.compute(input);
      const busser = result.results.find((r) => r.employeeId === 'e2');
      const minimum = toDecimal(2).mul(toDecimal(1));

      expect(busser).toBeDefined();
      expect(busser!.amount.gte(minimum)).toBe(true);
      expect(busser!.explanation.minimumApplied).toBe(true);
      expect(sumAmounts(result.results).toFixed(2)).toBe('500.00');
    });
  });

  describe('validations', () => {
    it('throw si aucun employé', () => {
      const input = makeInput([], 500);

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si pool <= 0', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 0);

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si hoursWorked <= 0', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1', hoursWorked: toDecimal(0) })], 500);

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si employeeId dupliqué', () => {
      const input = makeInput(
        [makeEmployee({ employeeId: 'e1' }), makeEmployee({ employeeId: 'e1' })],
        500,
      );

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si salesGenerated < 0', () => {
      const input = makeInput(
        [makeEmployee({ employeeId: 'e1', salesGenerated: toDecimal(-1) })],
        500,
      );

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si coefficient <= 0', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1', coefficient: toDecimal(0) })], 500);

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si minimumPerHour total dépasse le pool', () => {
      const input = makeInput(
        [
          makeEmployee({ employeeId: 'e1', hoursWorked: toDecimal(8) }),
          makeEmployee({ employeeId: 'e2', hoursWorked: toDecimal(8) }),
        ],
        10,
        { minimumPerHour: toDecimal(5), maxSharePercent: toDecimal(100) },
      );

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si salesBonusWeight < 0', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 100, {
        salesBonusWeight: toDecimal(-0.1),
        maxSharePercent: toDecimal(100),
      });

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si maxSharePercent <= 0', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 100, {
        maxSharePercent: toDecimal(0),
      });

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });

    it('throw si maxSharePercent > 100', () => {
      const input = makeInput([makeEmployee({ employeeId: 'e1' })], 100, {
        maxSharePercent: toDecimal(101),
      });

      expect(() => service.compute(input)).toThrow(BadRequestException);
    });
  });

  describe('déterminisme', () => {
    it('deux appels identiques produisent exactement le même résultat', () => {
      const employees = [
        makeEmployee({
          employeeId: 'e1',
          salesGenerated: toDecimal(700),
        }),
        makeEmployee({
          employeeId: 'e2',
          salesGenerated: toDecimal(300),
        }),
        makeEmployee({
          employeeId: 'e3',
          role: EmployeeRole.BUSSER,
          salesGenerated: toDecimal(0),
        }),
      ];

      const input = makeInput(employees, 450);
      const result1 = service.compute(input);
      const result2 = service.compute(input);

      expect(result1.results).toHaveLength(result2.results.length);

      result1.results.forEach((result, index) => {
        expect(result.amount.toFixed(2)).toBe(result2.results[index].amount.toFixed(2));
        expect(result.employeeId).toBe(result2.results[index].employeeId);
      });
    });
  });
});
