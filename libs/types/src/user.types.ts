import { BaseEntity, UserRole, Language, PaginationParams } from './common.types';
import { Timestamp } from './firebase.types';

export interface User extends BaseEntity {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  apartmentNumber?: string;
  phoneNumber?: string;
  preferredLanguage: Language;
  isActive: boolean;
  fcmToken?: string;
}

export interface CreateUserDto {
  email: string;
  displayName: string;
  role: UserRole;
  apartmentNumber?: string;
  phoneNumber?: string;
  preferredLanguage?: Language;
}

export interface UpdateUserDto {
  displayName?: string;
  role?: UserRole;
  apartmentNumber?: string;
  phoneNumber?: string;
  preferredLanguage?: Language;
  isActive?: boolean;
  fcmToken?: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface UserProfileDto {
  displayName?: string;
  apartmentNumber?: string;
  phoneNumber?: string;
  preferredLanguage?: Language;
}

export interface UserQueryParams extends PaginationParams {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  apartmentNumber?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  apartmentNumber?: string;
  phoneNumber?: string;
  preferredLanguage: Language;
  isActive: boolean;
  fcmToken?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPermissions {
  canManageUsers: boolean;
  canManagePayments: boolean;
  canManageReservations: boolean;
  canManageMeetings: boolean;
  canViewReports: boolean;
  canAccessAdminPanel: boolean;
}