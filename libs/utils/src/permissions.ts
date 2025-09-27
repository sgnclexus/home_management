import { UserRole, UserPermissions } from '@home-management/types';

/**
 * Get user permissions based on their role
 */
export const getUserPermissions = (role: UserRole): UserPermissions => {
  switch (role) {
    case UserRole.ADMIN:
      return {
        canManageUsers: true,
        canManagePayments: true,
        canManageReservations: true,
        canManageMeetings: true,
        canViewReports: true,
        canAccessAdminPanel: true,
      };

    case UserRole.VIGILANCE:
      return {
        canManageUsers: false,
        canManagePayments: true,
        canManageReservations: true,
        canManageMeetings: true,
        canViewReports: true,
        canAccessAdminPanel: true,
      };

    case UserRole.RESIDENT:
      return {
        canManageUsers: false,
        canManagePayments: false,
        canManageReservations: false,
        canManageMeetings: false,
        canViewReports: false,
        canAccessAdminPanel: false,
      };

    case UserRole.SECURITY:
      return {
        canManageUsers: false,
        canManagePayments: false,
        canManageReservations: true,
        canManageMeetings: false,
        canViewReports: false,
        canAccessAdminPanel: false,
      };

    default:
      return {
        canManageUsers: false,
        canManagePayments: false,
        canManageReservations: false,
        canManageMeetings: false,
        canViewReports: false,
        canAccessAdminPanel: false,
      };
  }
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (role: UserRole, permission: keyof UserPermissions): boolean => {
  const permissions = getUserPermissions(role);
  return permissions[permission];
};

/**
 * Check if user can access admin features
 */
export const canAccessAdmin = (role: UserRole): boolean => {
  return hasPermission(role, 'canAccessAdminPanel');
};

/**
 * Check if user can manage other users
 */
export const canManageUsers = (role: UserRole): boolean => {
  return hasPermission(role, 'canManageUsers');
};

/**
 * Check if user can manage payments
 */
export const canManagePayments = (role: UserRole): boolean => {
  return hasPermission(role, 'canManagePayments');
};

/**
 * Check if user can manage reservations
 */
export const canManageReservations = (role: UserRole): boolean => {
  return hasPermission(role, 'canManageReservations');
};

/**
 * Check if user can manage meetings
 */
export const canManageMeetings = (role: UserRole): boolean => {
  return hasPermission(role, 'canManageMeetings');
};

/**
 * Check if user can view reports
 */
export const canViewReports = (role: UserRole): boolean => {
  return hasPermission(role, 'canViewReports');
};

/**
 * Get roles that have a specific permission
 */
export const getRolesWithPermission = (permission: keyof UserPermissions): UserRole[] => {
  return Object.values(UserRole).filter(role => hasPermission(role, permission));
};

/**
 * Check if user can perform action on another user
 */
export const canManageUser = (currentUserRole: UserRole, targetUserRole: UserRole): boolean => {
  // Only admins can manage other users
  if (!canManageUsers(currentUserRole)) {
    return false;
  }

  // Admins can manage all users
  if (currentUserRole === UserRole.ADMIN) {
    return true;
  }

  return false;
};