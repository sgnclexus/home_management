import {
  getUserPermissions,
  hasPermission,
  canAccessAdmin,
  canManageUsers,
  canManagePayments,
  canManageReservations,
  canManageMeetings,
  canViewReports,
  getRolesWithPermission,
  canManageUser,
} from '../permissions';
import { UserRole } from '@home-management/types';

describe('User Permissions Utilities', () => {
  describe('getUserPermissions', () => {
    it('should return correct permissions for ADMIN role', () => {
      const permissions = getUserPermissions(UserRole.ADMIN);
      expect(permissions).toEqual({
        canManageUsers: true,
        canManagePayments: true,
        canManageReservations: true,
        canManageMeetings: true,
        canViewReports: true,
        canAccessAdminPanel: true,
      });
    });

    it('should return correct permissions for VIGILANCE role', () => {
      const permissions = getUserPermissions(UserRole.VIGILANCE);
      expect(permissions).toEqual({
        canManageUsers: false,
        canManagePayments: true,
        canManageReservations: true,
        canManageMeetings: true,
        canViewReports: true,
        canAccessAdminPanel: true,
      });
    });

    it('should return correct permissions for RESIDENT role', () => {
      const permissions = getUserPermissions(UserRole.RESIDENT);
      expect(permissions).toEqual({
        canManageUsers: false,
        canManagePayments: false,
        canManageReservations: false,
        canManageMeetings: false,
        canViewReports: false,
        canAccessAdminPanel: false,
      });
    });

    it('should return correct permissions for SECURITY role', () => {
      const permissions = getUserPermissions(UserRole.SECURITY);
      expect(permissions).toEqual({
        canManageUsers: false,
        canManagePayments: false,
        canManageReservations: true,
        canManageMeetings: false,
        canViewReports: false,
        canAccessAdminPanel: false,
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', () => {
      expect(hasPermission(UserRole.ADMIN, 'canManageUsers')).toBe(true);
      expect(hasPermission(UserRole.VIGILANCE, 'canManagePayments')).toBe(true);
      expect(hasPermission(UserRole.SECURITY, 'canManageReservations')).toBe(true);
    });

    it('should return false when user does not have permission', () => {
      expect(hasPermission(UserRole.RESIDENT, 'canManageUsers')).toBe(false);
      expect(hasPermission(UserRole.SECURITY, 'canManagePayments')).toBe(false);
      expect(hasPermission(UserRole.VIGILANCE, 'canManageUsers')).toBe(false);
    });
  });

  describe('canAccessAdmin', () => {
    it('should return true for admin and vigilance roles', () => {
      expect(canAccessAdmin(UserRole.ADMIN)).toBe(true);
      expect(canAccessAdmin(UserRole.VIGILANCE)).toBe(true);
    });

    it('should return false for resident and security roles', () => {
      expect(canAccessAdmin(UserRole.RESIDENT)).toBe(false);
      expect(canAccessAdmin(UserRole.SECURITY)).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    it('should return true only for admin role', () => {
      expect(canManageUsers(UserRole.ADMIN)).toBe(true);
      expect(canManageUsers(UserRole.VIGILANCE)).toBe(false);
      expect(canManageUsers(UserRole.RESIDENT)).toBe(false);
      expect(canManageUsers(UserRole.SECURITY)).toBe(false);
    });
  });

  describe('canManagePayments', () => {
    it('should return true for admin and vigilance roles', () => {
      expect(canManagePayments(UserRole.ADMIN)).toBe(true);
      expect(canManagePayments(UserRole.VIGILANCE)).toBe(true);
    });

    it('should return false for resident and security roles', () => {
      expect(canManagePayments(UserRole.RESIDENT)).toBe(false);
      expect(canManagePayments(UserRole.SECURITY)).toBe(false);
    });
  });

  describe('canManageReservations', () => {
    it('should return true for admin, vigilance, and security roles', () => {
      expect(canManageReservations(UserRole.ADMIN)).toBe(true);
      expect(canManageReservations(UserRole.VIGILANCE)).toBe(true);
      expect(canManageReservations(UserRole.SECURITY)).toBe(true);
    });

    it('should return false for resident role', () => {
      expect(canManageReservations(UserRole.RESIDENT)).toBe(false);
    });
  });

  describe('canManageMeetings', () => {
    it('should return true for admin and vigilance roles', () => {
      expect(canManageMeetings(UserRole.ADMIN)).toBe(true);
      expect(canManageMeetings(UserRole.VIGILANCE)).toBe(true);
    });

    it('should return false for resident and security roles', () => {
      expect(canManageMeetings(UserRole.RESIDENT)).toBe(false);
      expect(canManageMeetings(UserRole.SECURITY)).toBe(false);
    });
  });

  describe('canViewReports', () => {
    it('should return true for admin and vigilance roles', () => {
      expect(canViewReports(UserRole.ADMIN)).toBe(true);
      expect(canViewReports(UserRole.VIGILANCE)).toBe(true);
    });

    it('should return false for resident and security roles', () => {
      expect(canViewReports(UserRole.RESIDENT)).toBe(false);
      expect(canViewReports(UserRole.SECURITY)).toBe(false);
    });
  });

  describe('getRolesWithPermission', () => {
    it('should return correct roles for canManageUsers permission', () => {
      const roles = getRolesWithPermission('canManageUsers');
      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('should return correct roles for canManagePayments permission', () => {
      const roles = getRolesWithPermission('canManagePayments');
      expect(roles).toEqual([UserRole.ADMIN, UserRole.VIGILANCE]);
    });

    it('should return correct roles for canManageReservations permission', () => {
      const roles = getRolesWithPermission('canManageReservations');
      expect(roles).toEqual([UserRole.ADMIN, UserRole.VIGILANCE, UserRole.SECURITY]);
    });
  });

  describe('canManageUser', () => {
    it('should allow admin to manage any user', () => {
      expect(canManageUser(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
      expect(canManageUser(UserRole.ADMIN, UserRole.VIGILANCE)).toBe(true);
      expect(canManageUser(UserRole.ADMIN, UserRole.RESIDENT)).toBe(true);
      expect(canManageUser(UserRole.ADMIN, UserRole.SECURITY)).toBe(true);
    });

    it('should not allow non-admin roles to manage users', () => {
      expect(canManageUser(UserRole.VIGILANCE, UserRole.RESIDENT)).toBe(false);
      expect(canManageUser(UserRole.RESIDENT, UserRole.RESIDENT)).toBe(false);
      expect(canManageUser(UserRole.SECURITY, UserRole.RESIDENT)).toBe(false);
    });
  });
});