import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtime } from '../../contexts/RealtimeContext';
import { Payment, PaymentStatus } from '@home-management/types';
import { PaymentHistory } from './PaymentHistory';
import { PaymentForm } from './PaymentForm';
import { RealtimeStatusBadge, OptimisticUpdateIndicator, DataLoadingState } from '../realtime/LoadingStates';

interface PaymentDashboardProps {
  className?: string;
}

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ className = '' }) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { payments: realtimePayments, updatePayment, refreshData } = useRealtime();
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Update current payment when real-time data changes
  useEffect(() => {
    if (realtimePayments.data.length > 0) {
      const pending = realtimePayments.data.find((payment: Payment) => payment.status === 'pending');
      setCurrentPayment(pending || null);
    }
  }, [realtimePayments.data]);

  const handlePaymentSuccess = async () => {
    setShowPaymentForm(false);
    // Real-time updates will automatically reflect the changes
    // Optionally trigger a manual refresh if needed
    refreshData();
  };



  // Use DataLoadingState component for consistent loading/error handling
  return (
    <DataLoadingState
      loading={realtimePayments.loading}
      error={realtimePayments.error}
      retryAction={refreshData}
    >
      <PaymentDashboardContent
        className={className}
        payments={realtimePayments.data}
        currentPayment={currentPayment}
        lastUpdated={realtimePayments.lastUpdated}
        showPaymentForm={showPaymentForm}
        setShowPaymentForm={setShowPaymentForm}
        handlePaymentSuccess={handlePaymentSuccess}
        updatePayment={updatePayment}
        t={t}
        getStatusColor={getStatusColor}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />
    </DataLoadingState>
  );
};

interface PaymentDashboardContentProps {
  className: string;
  payments: Payment[];
  currentPayment: Payment | null;
  lastUpdated: Date | null;
  showPaymentForm: boolean;
  setShowPaymentForm: (show: boolean) => void;
  handlePaymentSuccess: () => void;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;
  t: (key: string) => string;
  getStatusColor: (status: PaymentStatus) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string | undefined) => string;
}

const PaymentDashboardContent: React.FC<PaymentDashboardContentProps> = ({
  className,
  payments,
  currentPayment,
  lastUpdated,
  showPaymentForm,
  setShowPaymentForm,
  handlePaymentSuccess,
  updatePayment,
  t,
  getStatusColor,
  formatCurrency,
  formatDate
}) => {

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">{t('payments.dashboard.title')}</h2>
          <RealtimeStatusBadge lastUpdated={lastUpdated} />
        </div>
        <p className="text-gray-600">{t('payments.dashboard.description')}</p>
      </div>

      {/* Current Payment Card */}
      {currentPayment && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-yellow-400">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('payments.currentPayment')}</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentPayment.status)}`}>
              {t(`payments.status.${currentPayment.status}`)}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">{t('amount')}</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(currentPayment.amount, currentPayment.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('payments.dueDate')}</p>
              <p className="text-lg font-medium text-gray-900">
                {formatDate(currentPayment.dueDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('payments.description')}</p>
              <p className="text-lg font-medium text-gray-900">{currentPayment.description}</p>
            </div>
          </div>

          {currentPayment.status === 'pending' && (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              {t('payments.payNow')}
            </button>
          )}
        </div>
      )}

      {/* No Current Payment */}
      {!currentPayment && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">{t('payments.noPendingPayments')}</h3>
              <div className="mt-2 text-sm text-green-700">{t('payments.allPaymentsCurrent')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <PaymentHistory payments={payments} />

      {/* Payment Form Modal */}
      {showPaymentForm && currentPayment && (
        <PaymentForm
          payment={currentPayment}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentForm(false)}
        />
      )}
    </div>
  );
};

// Helper functions moved outside component to avoid re-creation
const getStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case 'paid':
      return 'text-green-600 bg-green-100';
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'overdue':
      return 'text-red-600 bg-red-100';
    case 'cancelled':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  } catch (error) {
    console.warn('Invalid date format:', date);
    return '-';
  }
};