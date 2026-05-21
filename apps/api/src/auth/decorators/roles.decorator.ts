import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

export const Roles = (role: UserRole, ...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, [role, ...roles]);
