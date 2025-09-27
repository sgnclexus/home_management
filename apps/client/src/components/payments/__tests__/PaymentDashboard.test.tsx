import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { PaymentDashboard } from '../PaymentDashboard';
import { useAuth } from '../../../contexts/AuthContext';
import { Payment } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock child components
jest.mock('../PaymentHistory', () => ({
  PaymentHistory: ({ payments }: { payments: Payment[] }) => (
    <div data-testid="payment-history">Payment History: {payments.length} payments</div>
  ),
}));

jest.mock('../PaymentForm', () => ({
  PaymentForm: ({ payment, onSuccess, onCancel }: any) => (
    <div data-testid="payment-form">
      <div>Payment Form for: {payment.description}</div>
      <button onClick={onSuccess}>Success</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockPayments: Payment[] = [
  {
    id: '1',
    userId: 'test-user-id',
    amount: 150.00,
    currency: 'USD',
    description: 'Monthly maintenance fee - January 2024',
    status: 'pending',
    dueDate: new Date('2024-01-31'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    userId: 'test-user-id',
    amount: 150.00,
    currency: 'USD',
    description: 'Monthly maintenance fee - December 2023',
    status: 'paid',
    dueDate: new Date('2023-12-31'),
    paidDate: new Date('2023-12-28'),
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-28'),
  },
];

const mockTranslations = {
  loading: 'Loading...',
  error: 'Error',
  retry: 'Retry',
  'payments.dashboard.title': 'Payment Dashboard',
  'payments.dashboard.description': 'View and manage your condominium payments',
  'payments.currentPayment': 'Current Payment Due',
  'payments.noPendingPayments': 'No Pending Payments',
  'payments.allPaymentsCurrent': 'All your payments are up to date!',
  'payments.payNow': 'Pay Now',
  'payments.loadError': 'Failed to load payments',
  'payments.dueDate': 'Due Date',
  'payments.description': 'Description',
  'payments.status.pending': 'Pending',
  'payments.status.paid': 'Paid',
  amount: 'Amount',
};

describe('PaymentDashboard', () => {
  const mockT = jest.fn((key: string) => mockTranslations[key as keyof typeof mockTranslations] || key);

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<PaymentDashboard />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders payment dashboard with current payment', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Payment Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('View and manage your condominium payments')).toBeInTheDocument();
    expect(screen.getByText('Current Payment Due')).toBeInTheDocument();
    expect(screen.getByText('Monthly maintenance fee - January 2024')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('Pay Now')).toBeInTheDocument();
  });

  it('renders no pending payments message when no pending payments exist', async () => {
    const paidPayments = mockPayments.filter(p => p.status === 'paid');
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => paidPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No Pending Payments')).toBeInTheDocument();
    });

    expect(screen.getByText('All your payments are up to date!')).toBeInTheDocument();
    expect(screen.queryByText('Pay Now')).not.toBeInTheDocument();
  });

  it('handles fetch error gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load payments')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('opens payment form when Pay Now is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pay Now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pay Now'));

    expect(screen.getByTestId('payment-form')).toBeInTheDocument();
    expect(screen.getByText('Payment Form for: Monthly maintenance fee - January 2024')).toBeInTheDocument();
  });

  it('closes payment form when cancelled', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pay Now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pay Now'));
    expect(screen.getByTestId('payment-form')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  it('refreshes payments after successful payment', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments.filter(p => p.status === 'paid'),
      });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pay Now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pay Now'));
    fireEvent.click(screen.getByText('Success'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByTestId('payment-form')).not.toBeInTheDocument();
  });

  it('renders payment history component', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-history')).toBeInTheDocument();
    });

    expect(screen.getByText('Payment History: 2 payments')).toBeInTheDocument();
  });

  it('makes correct API call to fetch payments', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/payments/user/${mockUser.uid}`,
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });
  });

  it('does not fetch payments when user is not authenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<PaymentDashboard />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('formats currency correctly', async () => {
    const paymentWithEUR = [{
      ...mockPayments[0],
      currency: 'EUR',
      amount: 125.50,
    }];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => paymentWithEUR,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('€125.50')).toBeInTheDocument();
    });
  });

  it('formats dates correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayments,
    });

    render(<PaymentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Jan 30, 2024')).toBeInTheDocument();
    });
  });
});