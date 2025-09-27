import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Payment, PaymentMethod } from '@home-management/types';

interface PaymentFormProps {
  payment: Payment;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ payment, onSuccess, onCancel }) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const processPayment = async () => {
    if (!user) return;

    try {
      setProcessing(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/${payment.id}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod: selectedMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment processing failed');
      }

      const result = await response.json();
      
      if (result.success) {
        onSuccess();
      } else {
        throw new Error(result.error || 'Payment processing failed');
      }
    } catch (err) {
      console.error('Payment processing error:', err);
      setError(err instanceof Error ? err.message : t('payments.processError'));
    } finally {
      setProcessing(false);
    }
  };

  const handleStripePayment = async () => {
    // In a real implementation, this would integrate with Stripe Elements
    // For now, we'll simulate the payment process
    await processPayment();
  };

  const handlePayPalPayment = async () => {
    // In a real implementation, this would integrate with PayPal SDK
    // For now, we'll simulate the payment process
    await processPayment();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedMethod === 'stripe') {
      await handleStripePayment();
    } else if (selectedMethod === 'paypal') {
      await handlePayPalPayment();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('payments.processPayment')}</h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              disabled={processing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">{t('payments.description')}:</span>
              <span className="text-sm font-medium text-gray-900">{payment.description}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">{t('payments.dueDate')}:</span>
              <span className="text-sm font-medium text-gray-900">
                {new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                }).format(new Date(payment.dueDate))}
              </span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-base font-semibold text-gray-900">{t('total')}:</span>
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
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

          {/* Payment Method Selection */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('payments.selectPaymentMethod')}
              </label>
              
              <div className="space-y-3">
                {/* Stripe Option */}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="stripe"
                    checked={selectedMethod === 'stripe'}
                    onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={processing}
                  />
                  <div className="ml-3 flex items-center">
                    <div className="flex items-center space-x-2">
                      <svg className="w-8 h-5" viewBox="0 0 40 24" fill="none">
                        <rect width="40" height="24" rx="4" fill="#635BFF"/>
                        <path d="M8.5 8.5h4.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5H8.5V8.5z" fill="white"/>
                        <path d="M20.5 8.5h4.5c2.5 0 4.5 2 4.5 4.5s-2 4.5-4.5 4.5h-4.5V8.5z" fill="white"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{t('payments.methods.stripe')}</span>
                    </div>
                  </div>
                </label>

                {/* PayPal Option */}
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    checked={selectedMethod === 'paypal'}
                    onChange={(e) => setSelectedMethod(e.target.value as PaymentMethod)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    disabled={processing}
                  />
                  <div className="ml-3 flex items-center">
                    <div className="flex items-center space-x-2">
                      <svg className="w-8 h-5" viewBox="0 0 40 24" fill="none">
                        <rect width="40" height="24" rx="4" fill="#0070BA"/>
                        <path d="M12 8h8c2 0 3.5 1.5 3.5 3.5S22 15 20 15h-4l-1 4H12l3-11z" fill="white"/>
                        <path d="M16 12h4c1 0 2 .5 2 1.5S21 15 20 15h-2l-.5 2H16l1.5-5.5z" fill="#00A1C9"/>
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{t('payments.methods.paypal')}</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Payment Method Details */}
            {selectedMethod === 'stripe' && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">{t('payments.stripe.description')}</p>
                <div className="text-xs text-blue-600">
                  {t('payments.stripe.secureNote')}
                </div>
              </div>
            )}

            {selectedMethod === 'paypal' && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">{t('payments.paypal.description')}</p>
                <div className="text-xs text-blue-600">
                  {t('payments.paypal.redirectNote')}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={processing}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('payments.processing')}
                  </>
                ) : (
                  <>
                    {t('payments.payNow')} {formatCurrency(payment.amount, payment.currency)}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};