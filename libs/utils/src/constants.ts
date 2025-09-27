import { UserRole } from '@home-management/types';

export const USER_ROLES: Record<UserRole, string> = {
  admin: 'Administrator',
  vigilance: 'Vigilance Committee',
  resident: 'Resident',
  security: 'Security',
};

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

export const RESERVATION_STATUSES = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export const MEETING_STATUSES = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const SUPPORTED_LANGUAGES = {
  ES: 'es',
  EN: 'en',
} as const;

export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const API_ENDPOINTS = {
  AUTH: '/auth',
  USERS: '/users',
  PAYMENTS: '/payments',
  RESERVATIONS: '/reservations',
  MEETINGS: '/meetings',
  NOTIFICATIONS: '/notifications',
} as const;