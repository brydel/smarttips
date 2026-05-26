import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmployeeInvitationStatus, EmployeeRole, UserRole } from '@prisma/client';

import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('InvitationsService', () => {
  let service: InvitationsService;

  const prisma = {
    $transaction: jest.fn(),
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    employeeInvitation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };

  const email = {
    sendInvitationEmail: jest.fn(),
  };

  const config = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const jwt = {
    signAsync: jest.fn(),
  };

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const invitedBy = '22222222-2222-4222-8222-222222222222';
  const employeeId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    jest.clearAllMocks();

    service = new InvitationsService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      config as unknown as ConfigService,
      jwt as unknown as JwtService,
    );

    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'INVITATION_TTL_DAYS') return 7;
      return fallback;
    });

    jwt.signAsync.mockResolvedValue('mock-access-token');
  });

  describe('create', () => {
    it('crée une invitation et envoie un email', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: employeeId,
            firstName: 'John',
            lastName: 'Doe',
            email: null,
            active: true,
            userId: null,
            tenant: {
              name: 'Restaurant Test',
            },
          }),
        },
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: invitedBy,
              name: 'Owner Test',
            })
            .mockResolvedValueOnce(null),
        },
        employeeInvitation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'invitation-id',
            email: 'employee@test.com',
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            tenant: {
              name: 'Restaurant Test',
            },
            inviter: {
              name: 'Owner Test',
            },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      const result = await service.create(tenantId, invitedBy, {
        employeeId,
        email: 'employee@test.com',
      });

      expect(result.email).toBe('employee@test.com');
      expect(result.inviteUrl).toContain('http://localhost:3000/invite?token=');
      expect(tx.employeeInvitation.create).toHaveBeenCalledTimes(1);
      expect(email.sendInvitationEmail).toHaveBeenCalledWith(
        'employee@test.com',
        'Restaurant Test',
        'Owner Test',
        expect.stringContaining('/invite?token='),
      );
    });

    it('throw si employee introuvable', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.create(tenantId, invitedBy, {
          employeeId,
          email: 'employee@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throw si employee déjà lié à un user', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: employeeId,
            active: true,
            userId: 'existing-user-id',
            tenant: {
              name: 'Restaurant Test',
            },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.create(tenantId, invitedBy, {
          employeeId,
          email: 'employee@test.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throw si employee inactif', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: employeeId,
            active: false,
            userId: null,
            tenant: {
              name: 'Restaurant Test',
            },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.create(tenantId, invitedBy, {
          employeeId,
          email: 'employee@test.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throw si email déjà utilisé dans le tenant', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: employeeId,
            active: true,
            userId: null,
            tenant: {
              name: 'Restaurant Test',
            },
          }),
        },
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: invitedBy,
              name: 'Owner Test',
            })
            .mockResolvedValueOnce({
              id: 'existing-user-id',
            }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.create(tenantId, invitedBy, {
          employeeId,
          email: 'employee@test.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('révoque l’invitation si l’email échoue', async () => {
      const tx = {
        employee: {
          findFirst: jest.fn().mockResolvedValue({
            id: employeeId,
            firstName: 'John',
            lastName: 'Doe',
            active: true,
            userId: null,
            tenant: {
              name: 'Restaurant Test',
            },
          }),
        },
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: invitedBy,
              name: 'Owner Test',
            })
            .mockResolvedValueOnce(null),
        },
        employeeInvitation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'invitation-id',
            email: 'employee@test.com',
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            tenant: {
              name: 'Restaurant Test',
            },
            inviter: {
              name: 'Owner Test',
            },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));
      prisma.employeeInvitation.updateMany.mockResolvedValue({ count: 1 });
      email.sendInvitationEmail.mockRejectedValue(new Error('email failed'));

      await expect(
        service.create(tenantId, invitedBy, {
          employeeId,
          email: 'employee@test.com',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(prisma.employeeInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'invitation-id',
          status: EmployeeInvitationStatus.PENDING,
        },
        data: {
          status: EmployeeInvitationStatus.REVOKED,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('validate', () => {
    it('valide une invitation pending non expirée', async () => {
      prisma.employeeInvitation.findUnique.mockResolvedValue({
        email: 'employee@test.com',
        status: EmployeeInvitationStatus.PENDING,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        tenant: {
          name: 'Restaurant Test',
        },
        employee: {
          firstName: 'John',
          lastName: 'Doe',
          role: EmployeeRole.SERVER,
          active: true,
          deletedAt: null,
          userId: null,
        },
      });

      const result = await service.validate('a'.repeat(64));

      expect(result.valid).toBe(true);
      expect(result.email).toBe('employee@test.com');
      expect(result.employee.firstName).toBe('John');
    });

    it('throw si token mal formé', async () => {
      await expect(service.validate('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('throw si invitation introuvable', async () => {
      prisma.employeeInvitation.findUnique.mockResolvedValue(null);

      await expect(service.validate('a'.repeat(64))).rejects.toThrow(NotFoundException);
    });

    it('expire une invitation expirée', async () => {
      prisma.employeeInvitation.findUnique.mockResolvedValue({
        email: 'employee@test.com',
        status: EmployeeInvitationStatus.PENDING,
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        tenant: {
          name: 'Restaurant Test',
        },
        employee: {
          firstName: 'John',
          lastName: 'Doe',
          role: EmployeeRole.SERVER,
          active: true,
          deletedAt: null,
          userId: null,
        },
      });

      prisma.employeeInvitation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.validate('a'.repeat(64))).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.employeeInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: expect.any(String),
          status: EmployeeInvitationStatus.PENDING,
        },
        data: {
          status: EmployeeInvitationStatus.EXPIRED,
        },
      });
    });
  });

  describe('accept', () => {
    it('accepte une invitation et crée le user EMPLOYEE', async () => {
      const tx = {
        employeeInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'invitation-id',
            tenantId,
            employeeId,
            email: 'employee@test.com',
            status: EmployeeInvitationStatus.PENDING,
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            employee: {
              id: employeeId,
              active: true,
              deletedAt: null,
              userId: null,
            },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue({}),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({
            id: 'new-user-id',
            tenantId,
            email: 'employee@test.com',
            role: UserRole.EMPLOYEE,
            name: 'John Doe',
          }),
        },
        employee: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      const result = await service.accept('a'.repeat(64), {
        firstName: 'John',
        lastName: 'Doe',
        password: 'Password123',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.role).toBe(UserRole.EMPLOYEE);

      expect(tx.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          email: 'employee@test.com',
          role: UserRole.EMPLOYEE,
          name: 'John Doe',
          emailVerified: true,
        }),
        select: expect.any(Object),
      });

      expect(tx.employee.update).toHaveBeenCalledWith({
        where: {
          id: employeeId,
        },
        data: {
          userId: 'new-user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'employee@test.com',
        },
      });
    });

    it('throw si invitation déjà acceptée', async () => {
      const tx = {
        employeeInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'invitation-id',
            status: EmployeeInvitationStatus.ACCEPTED,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.accept('a'.repeat(64), {
          firstName: 'John',
          lastName: 'Doe',
          password: 'Password123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throw si acceptation concurrente', async () => {
      const tx = {
        employeeInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'invitation-id',
            tenantId,
            employeeId,
            email: 'employee@test.com',
            status: EmployeeInvitationStatus.PENDING,
            expiresAt: new Date('2030-01-01T00:00:00.000Z'),
            employee: {
              id: employeeId,
              active: true,
              deletedAt: null,
              userId: null,
            },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => callback(tx));

      await expect(
        service.accept('a'.repeat(64), {
          firstName: 'John',
          lastName: 'Doe',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revoke', () => {
    it('révoque une invitation pending', async () => {
      prisma.employeeInvitation.findFirst.mockResolvedValue({
        id: 'invitation-id',
        status: EmployeeInvitationStatus.PENDING,
      });

      prisma.employeeInvitation.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.revoke(tenantId, 'invitation-id')).resolves.toBeUndefined();

      expect(prisma.employeeInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'invitation-id',
          tenantId,
          status: EmployeeInvitationStatus.PENDING,
        },
        data: {
          status: EmployeeInvitationStatus.REVOKED,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('throw si invitation introuvable', async () => {
      prisma.employeeInvitation.findFirst.mockResolvedValue(null);

      await expect(service.revoke(tenantId, 'missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throw si invitation non révocable', async () => {
      prisma.employeeInvitation.findFirst.mockResolvedValue({
        id: 'invitation-id',
        status: EmployeeInvitationStatus.ACCEPTED,
      });

      await expect(service.revoke(tenantId, 'invitation-id')).rejects.toThrow(ConflictException);
    });
  });
});
