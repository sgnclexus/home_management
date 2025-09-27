import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Payment, PaymentStatus } from '@home-management/types';

interface PaymentStatusUpdateProps {
  payment: Payment;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PaymentStatusUpdate: React.FC<PaymentStatusUpdateProps> = ({ payment, onSuccess, onCancel }) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [newStatus, setNewStatus] = useState<PaymentStatus>(payment.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || newStatus === payment.status) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/${payment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update payment status');
      }

      onSuccess();
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError(err instanceof Error ? err.message : t('payments.admin.updateStatusError'));
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const getStatusDescription = (status: PaymentStatus): string => {
    switch (status) {
      case 'paid':
        return t('payments.admin.statusDescriptions.paid');
      case 'pending':
        return t('payments.admin.statusDescriptions.pending');
      case 'overdue':
        return t('payments.admin.statusDescriptions.overdue');
      case 'cancelled':
        return t('payments.admin.statusDescriptions.cancelled');
      default:
        return '';
    }
  };

  const isStatusChangeValid = (fromStatus: PaymentStatus, toStatus: PaymentStatus): boolean => {
    // Define valid status transitions
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      pending: ['paid', 'overdue', 'cancelled'],
      overdue: ['paid', 'cancelled'],
      paid: ['cancelled'], // Only allow cancellation of paid payments
      cancelled: [], // Cannot change from cancelled
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  };

  const availableStatuses = (['pending', 'paid', 'overdue', 'cancelled'] as PaymentStatus[])
    .filter(status => status === payment.status || isStatusChangeValid(payment.status, status));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t('payments.admin.updateStatus')}</h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('payments.description')}:</span>
                <span className="text-sm font-medium text-gray-900">{payment.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('amount')}:</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{t('payments.dueDate')}:</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(payment.dueDate)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-sm text-gray-600">{t('payments.currentStatus')}:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                  {t(`payments.status.${payment.status}`)}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Status Selection Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('payments.admin.selectNewStatus')}
              </label>
              
              <div className="space-y-3">
                {availableStatuses.map((status) => (
                  <label key={status} className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={newStatus === status}
                      onChange={(e) => setNewStatus(e.target.value as PaymentStatus)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-0.5"
                      disabled={loading}
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {t(`payments.status.${status}`)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {t(`payments.status.${status}`)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {getStatusDescription(status)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Warning for status changes */}
            {newStatus !== payment.status && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      {t('payments.admin.statusChangeWarning', {
                        from: t(`payments.status.${payment.status}`),
                        to: t(`payments.status.${newStatus}`)
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || newStatus === payment.status}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('payments.admin.updating')}
                  </>
                ) : (
                  t('payments.admin.updateStatus')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};