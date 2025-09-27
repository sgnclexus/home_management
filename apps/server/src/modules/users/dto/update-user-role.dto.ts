import { IsEnum } from 'class-validator';
import { UserRole } from '@home-management/types';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}