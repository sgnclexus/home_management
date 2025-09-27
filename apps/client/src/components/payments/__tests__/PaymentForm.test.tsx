import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { PaymentForm } from '../PaymentForm';
import { useAuth } from '../../../contexts/AuthContext';
import { Payment } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockPayment: Payment = {
  id: 'payment-1',
  userId: 'test-user-id',
  amount: 150.00,
  currency: 'USD',
  description: 'Monthly maintenance fee - January 2024',
  status: 'pending',
  dueDate: new Date('2024-01-31'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockTranslations = {
  'payments.processPayment': 'Process Payment',
  'payments.description': 'Description',
  'payments.dueDate': 'Due Date',
  'payments.selectPaymentMethod': 'Select Payment Method',
  'payments.methods.stripe': 'Credit/Debit Card',
  'payments.methods.paypal': 'PayPal',
  'payments.stripe.description': 'Pay securely with your credit or debit card',
  'payments.stripe.secureNote': 'Your payment information is encrypted and secure',
  'payments.paypal.description': 'Pay with your PayPal account',
  'payments.paypal.redirectNote': 'You will be redirected to PayPal to complete your payment',
  'payments.payNow': 'Pay Now',
  'payments.processing': 'Processing...',
  'payments.processError': 'Payment processing failed. Please try again.',
  total: 'Total',
  cancel: 'Cancel',
};

describe('PaymentForm', () => {
  const mockT = jest.fn((key: string) => mockTranslations[key as keyof typeof mockTranslations] || key);
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
    mockOnSuccess.mockClear();
    mockOnCancel.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders payment form with payment details', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Process Payment')).toBeInTheDocument();
    expect(screen.getByText('Monthly maintenance fee - January 2024')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('Jan 30, 2024')).toBeInTheDocument();
  });

  it('renders payment method selection with Stripe selected by default', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Select Payment Method')).toBeInTheDocument();
    expect(screen.getByText('Credit/Debit Card')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();

    const stripeRadio = screen.getByDisplayValue('stripe');
    const paypalRadio = screen.getByDisplayValue('paypal');

    expect(stripeRadio).toBeChecked();
    expect(paypalRadio).not.toBeChecked();
  });

  it('allows switching between payment methods', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const paypalRadio = screen.getByDisplayValue('paypal');
    fireEvent.click(paypalRadio);

    expect(paypalRadio).toBeChecked();
    expect(screen.getByDisplayValue('stripe')).not.toBeChecked();
  });

  it('shows Stripe description when Stripe is selected', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Pay securely with your credit or debit card')).toBeInTheDocument();
    expect(screen.getByText('Your payment information is encrypted and secure')).toBeInTheDocument();
  });

  it('shows PayPal description when PayPal is selected', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const paypalRadio = screen.getByDisplayValue('paypal');
    fireEvent.click(paypalRadio);

    expect(screen.getByText('Pay with your PayPal account')).toBeInTheDocument();
    expect(screen.getByText('You will be redirected to PayPal to complete your payment')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button is clicked', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' }); // Close button with X icon
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('processes payment successfully with Stripe', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transactionId: 'stripe-tx-123' }),
    });

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/${mockPayment.id}/process`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'stripe',
          }),
        }
      );
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it('processes payment successfully with PayPal', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transactionId: 'paypal-tx-123' }),
    });

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select PayPal
    const paypalRadio = screen.getByDisplayValue('paypal');
    fireEvent.click(paypalRadio);

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/${mockPayment.id}/process`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod: 'paypal',
          }),
        }
      );
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it('handles payment processing error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Payment failed' }),
    });

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Payment failed')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('handles network error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('shows processing state during payment', async () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(payButton).toBeDisabled();
  });

  it('disables buttons during processing', async () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    const cancelButton = screen.getByText('Cancel');
    const closeButton = screen.getByRole('button', { name: '' });

    fireEvent.click(payButton);

    expect(payButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(closeButton).toBeDisabled();
  });

  it('formats currency correctly for different currencies', () => {
    const eurPayment = { ...mockPayment, currency: 'EUR', amount: 125.50 };

    render(
      <PaymentForm
        payment={eurPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('€125.50')).toBeInTheDocument();
    expect(screen.getByText('Pay Now €125.50')).toBeInTheDocument();
  });

  it('handles successful payment response without success flag', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Card declined' }),
    });

    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const payButton = screen.getByText('Pay Now $150.00');
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText('Card declined')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('renders modal overlay correctly', () => {
    render(
      <PaymentForm
        payment={mockPayment}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const overlay = document.querySelector('.fixed.inset-0.bg-gray-600.bg-opacity-50');
    expect(overlay).toBeInTheDocument();
  });
});