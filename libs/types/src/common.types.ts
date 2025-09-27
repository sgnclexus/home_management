export type Language = 'es' | 'en';

export enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}