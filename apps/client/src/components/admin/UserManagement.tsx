import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'next-i18next';
import { User, UserRole } from '@home-management/types';

interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const UserManagement: React.FC = () => {
  const { t } = useTranslation('common');
  const { user: currentUser, userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    role: '',
    isActive: '',
    search: '',
  });

  // Check if user has admin access
  const hasAdminAccess = userRole === UserRole.ADMIN || userRole === UserRole.VIGILANCE;

  // Load users
  const loadUsers = async () => {
    if (!currentUser || !hasAdminAccess) return;

    setLoading(true);
    setError(null);

    try {
      const token = await currentUser.getIdToken();
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.role && { role: filters.role }),
        ...(filters.isActive && { isActive: filters.isActive }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data: UserListResponse = await response.json();
        setUsers(data.users);
        setPagination(prev => ({
          ...prev,
          total: data.total,
          totalPages: data.totalPages,
        }));
      } else {
        setError(t('admin.users.loadError'));
      }
    } catch (error) {
      setError(t('admin.users.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Update user role
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!currentUser || userRole !== UserRole.ADMIN) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/role`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (response.ok) {
        setSuccess(t('admin.users.roleUpdateSuccess'));
        loadUsers(); // Reload users
      } else {
        const errorData = await response.json();
        setError(errorData.message || t('admin.users.roleUpdateError'));
      }
    } catch (error) {
      setError(t('admin.users.roleUpdateError'));
    }
  };

  // Toggle user active status
  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    if (!currentUser || userRole !== UserRole.ADMIN) return;

    try {
      const token = await currentUser.getIdToken();
      const endpoint = isActive ? 'reactivate' : 'deactivate';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/${userId}/${endpoint}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        setSuccess(t(`admin.users.${isActive ? 'activateSuccess' : 'deactivateSuccess'}`));
        loadUsers(); // Reload users
      } else {
        const errorData = await response.json();
        setError(errorData.message || t('admin.users.statusUpdateError'));
      }
    } catch (error) {
      setError(t('admin.users.statusUpdateError'));
    }
  };

  // Handle filter changes
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Load users when dependencies change
  useEffect(() => {
    loadUsers();
  }, [currentUser, hasAdminAccess, pagination.page, filters]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (!hasAdminAccess) {
    return (
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-red-600">
          {t('admin.users.accessDenied')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('admin.users.title')}
        </h2>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? t('admin.users.loading') : t('admin.users.refresh')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.users.search')}
          </label>
          <input
            type="text"
            id="search"
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder={t('admin.users.searchPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.users.filterByRole')}
          </label>
          <select
            id="role"
            name="role"
            value={filters.role}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('admin.users.allRoles')}</option>
            <option value={UserRole.ADMIN}>{t('roles.admin')}</option>
            <option value={UserRole.VIGILANCE}>{t('roles.vigilance')}</option>
            <option value={UserRole.RESIDENT}>{t('roles.resident')}</option>
            <option value={UserRole.SECURITY}>{t('roles.security')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="isActive" className="block text-sm font-medium text-gray-700 mb-1">
            {t('admin.users.filterByStatus')}
          </label>
          <select
            id="isActive"
            name="isActive"
            value={filters.isActive}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('admin.users.allStatuses')}</option>
            <option value="true">{t('admin.users.active')}</option>
            <option value="false">{t('admin.users.inactive')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('admin.users.user')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('admin.users.role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('admin.users.apartment')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('admin.users.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('admin.users.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.uid}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.displayName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {userRole === UserRole.ADMIN ? (
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.uid, e.target.value as UserRole)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={UserRole.ADMIN}>{t('roles.admin')}</option>
                      <option value={UserRole.VIGILANCE}>{t('roles.vigilance')}</option>
                      <option value={UserRole.RESIDENT}>{t('roles.resident')}</option>
                      <option value={UserRole.SECURITY}>{t('roles.security')}</option>
                    </select>
                  ) : (
                    <span className="text-sm text-gray-900">
                      {t(`roles.${user.role}`)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.apartmentNumber || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? t('admin.users.active') : t('admin.users.inactive')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {userRole === UserRole.ADMIN && user.uid !== currentUser?.uid && (
                    <button
                      onClick={() => toggleUserStatus(user.uid, !user.isActive)}
                      className={`${
                        user.isActive 
                          ? 'text-red-600 hover:text-red-900' 
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {user.isActive ? t('admin.users.deactivate') : t('admin.users.activate')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {t('admin.users.showing', {
              start: (pagination.page - 1) * pagination.limit + 1,
              end: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {t('admin.users.previous')}
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1 border rounded-md text-sm ${
                  page === pagination.page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              {t('admin.users.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};