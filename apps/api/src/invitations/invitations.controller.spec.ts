import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

describe('InvitationsController', () => {
  let controller: InvitationsController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    validate: jest.fn(),
    accept: jest.fn(),
    revoke: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        {
          provide: InvitationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<InvitationsController>(InvitationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
