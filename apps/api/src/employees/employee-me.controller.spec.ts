import { Test, TestingModule } from '@nestjs/testing';

import { EmployeeMeController } from './employee-me.controller';
import { EmployeeWalletService } from './employee-wallet.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

describe('EmployeeMeController', () => {
  let controller: EmployeeMeController;

  const mockService = {
    getDashboard: jest.fn(),
    getDistributions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeMeController],
      providers: [{ provide: EmployeeWalletService, useValue: mockService }],
    }).compile();

    controller = module.get<EmployeeMeController>(EmployeeMeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC', () => {
    // OWNER/MANAGER absents des rôles autorisés → RolesGuard répond 403.
    it.each([['getDashboard'], ['getDistributions']])('restricts %s to EMPLOYEE only', (method) => {
      const handler = EmployeeMeController.prototype[method as keyof EmployeeMeController];
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];

      expect(roles).toEqual([UserRole.EMPLOYEE]);
      expect(roles).not.toContain(UserRole.OWNER);
      expect(roles).not.toContain(UserRole.MANAGER);
    });
  });
});
