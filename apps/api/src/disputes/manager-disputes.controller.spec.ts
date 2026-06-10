import { Test, TestingModule } from '@nestjs/testing';

import { ManagerDisputesController } from './manager-disputes.controller';
import { DisputesService } from './disputes.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

describe('ManagerDisputesController', () => {
  let controller: ManagerDisputesController;

  const mockService = {
    list: jest.fn(),
    getById: jest.fn(),
    startReview: jest.fn(),
    resolve: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagerDisputesController],
      providers: [{ provide: DisputesService, useValue: mockService }],
    }).compile();

    controller = module.get<ManagerDisputesController>(ManagerDisputesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC', () => {
    // EMPLOYEE absent des rôles autorisés → RolesGuard répond 403.
    it.each([['list'], ['getById'], ['startReview'], ['resolve']])(
      'restricts %s to OWNER and MANAGER (never EMPLOYEE)',
      (method) => {
        const handler =
          ManagerDisputesController.prototype[method as keyof ManagerDisputesController];
        const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];

        expect(roles).toEqual(expect.arrayContaining([UserRole.OWNER, UserRole.MANAGER]));
        expect(roles).not.toContain(UserRole.EMPLOYEE);
      },
    );
  });
});
