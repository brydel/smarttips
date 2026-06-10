import { Test, TestingModule } from '@nestjs/testing';

import { EmployeeDisputesController } from './employee-disputes.controller';
import { DisputesService } from './disputes.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

describe('EmployeeDisputesController', () => {
  let controller: EmployeeDisputesController;

  const mockService = {
    create: jest.fn(),
    listMine: jest.fn(),
    withdraw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeDisputesController],
      providers: [{ provide: DisputesService, useValue: mockService }],
    }).compile();

    controller = module.get<EmployeeDisputesController>(EmployeeDisputesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC', () => {
    // Strictement EMPLOYEE : OWNER/MANAGER passent par /disputes.
    it.each([['create'], ['listMine'], ['withdraw']])('restricts %s to EMPLOYEE only', (method) => {
      const handler =
        EmployeeDisputesController.prototype[method as keyof EmployeeDisputesController];
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];

      expect(roles).toEqual([UserRole.EMPLOYEE]);
    });
  });

  it('forwards only JWT identity to the service — no employeeId from the request', async () => {
    const dto = {
      tipDistributionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      category: 'AMOUNT',
      message: 'Question sur le montant de mon pourboire.',
    };

    await controller.create('tenant-id', 'user-id', dto as never);

    expect(mockService.create).toHaveBeenCalledWith('tenant-id', 'user-id', dto);
  });
});
