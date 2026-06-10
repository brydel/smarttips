import { Test, TestingModule } from '@nestjs/testing';

import { ActionInboxController } from './action-inbox.controller';
import { ActionInboxService } from './action-inbox.service';
import { ActionInboxDetectorsService } from './action-inbox-detectors.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

describe('ActionInboxController', () => {
  let controller: ActionInboxController;

  const mockService = {
    list: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockDetectors = {
    refresh: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionInboxController],
      providers: [
        { provide: ActionInboxService, useValue: mockService },
        { provide: ActionInboxDetectorsService, useValue: mockDetectors },
      ],
    }).compile();

    controller = module.get<ActionInboxController>(ActionInboxController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC', () => {
    // EMPLOYEE absent des rôles autorisés → RolesGuard répond 403.
    it.each([['list'], ['refresh'], ['updateStatus']])(
      'restricts %s to OWNER and MANAGER (never EMPLOYEE)',
      (method) => {
        const handler = ActionInboxController.prototype[method as keyof ActionInboxController];
        const roles = Reflect.getMetadata(ROLES_KEY, handler) as UserRole[];

        expect(roles).toEqual(expect.arrayContaining([UserRole.OWNER, UserRole.MANAGER]));
        expect(roles).not.toContain(UserRole.EMPLOYEE);
      },
    );
  });
});
