import React, { useEffect } from 'react';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../components/auth/UserProfile';
import { UserManagement } from '../components/admin/UserManagement';
import { PaymentDashboard, AdminPaymentManagement } from '../components/payments';
import { ReservationDashboard } from '../components/reservations';
import { UserRole } from '@home-management/types';

export default function DashboardPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, userRole, loading, logout, refreshUserRole } = useAuth();
  const [activeTab, setActiveTab] = React.useState('profile');

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const hasAdminAccess = userRole === UserRole.ADMIN || userRole === UserRole.VIGILANCE;

  const tabs = [
    { id: 'profile', label: t('dashboard.profile'), component: UserProfile },
    { id: 'payments', label: t('dashboard.payments'), component: PaymentDashboard },
    { id: 'reservations', label: t('dashboard.reservations'), component: ReservationDashboard },
    ...(hasAdminAccess ? [
      { id: 'users', label: t('dashboard.userManagement'), component: UserManagement },
      { id: 'admin-payments', label: t('dashboard.adminPayments'), component: AdminPaymentManagement },
    ] : []),
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserProfile;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">
                {t('app.title')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {t('dashboard.welcome')}, <span className="font-medium">{user.displayName}</span>

              </div>

              {/* Temporary re-auth button for debugging */}
              <button
                onClick={async () => {
                  console.log('🔄 Re-authenticating...');
                  try {
                    await logout();
                    router.push('/auth');
                  } catch (error) {
                    console.error('❌ Re-auth failed:', error);
                  }
                }}
                className="bg-yellow-600 text-white px-3 py-1 text-sm rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              >
                🔄 Re-login
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ActiveComponent />
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'es', ['common'])),
    },
  };
};