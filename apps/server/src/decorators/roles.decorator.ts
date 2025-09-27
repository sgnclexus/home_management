import { SetMetadata } from '@nestjs/common';

enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);