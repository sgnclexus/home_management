import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { AdminPaymentManagement } from '../AdminPaymentManagement';
import { useAuth } from '../../../contexts/AuthContext';
import { Payment, User, UserRole } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock child components
jest.mock('../CreatePaymentForm', () => ({
  CreatePaymentForm: ({ users, onSuccess, onCancel }: any) => (
    <div data-testid="create-payment-form">
      <div>Create Payment Form</div>
      <div>Users: {users.length}</div>
      <button onClick={onSuccess}>Success</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

jest.mock('../PaymentStatusUpdate', () => ({
  PaymentStatusUpdate: ({ payment, onSuccess, onCancel }: any) => (
    <div data-testid="payment-status-update">
      <div>Update Status for: {payment.description}</div>
      <button onClick={onSuccess}>Success</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  uid: 'admin-user-id',
  email: 'admin@example.com',
  displayName: 'Admin User',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockUsers: User[] = [
  {
    id: 'user-1',
    uid: 'user-1',
    email: 'resident1@example.com',
    displayName: 'John Doe',
    role: UserRole.RESIDENT,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'user-2',
    uid: 'user-2',
    email: 'resident2@example.com',
    displayName: 'Jane Smith',
    role: UserRole.RESIDENT,
    apartmentNumber: '102',
    phoneNumber: '+1234567891',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockPayments: Payment[] = [
  {
    id: '1',
    userId: 'user-1',
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
    userId: 'user-2',
    amount: 150.00,
    currency: 'USD',
    description: 'Monthly maintenance fee - January 2024',
    status: 'paid',
    dueDate: new Date('2024-01-31'),
    paidDate: new Date('2024-01-28'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-28'),
  },
];

const mockTranslations = {
  loading: 'Loading...',
  error: 'Error',
  retry: 'Retry',
  actions: 'Actions',
  apartment: 'Apartment',
  amount: 'Amount',
  status: 'Status',
  'admin.accessDenied': 'Access denied. Admin privileges required.',
  'admin.users.refresh': 'Refresh',
  'payments.admin.title': 'Payment Management',
  'payments.admin.description': 'Manage resident payments and fees',
  'payments.admin.accessDenied': 'Administrator privileges required to manage payments.',
  'payments.admin.createPayment': 'Create Payment',
  'payments.admin.updateStatus': 'Update Status',
  'payments.admin.resident': 'Resident',
  'payments.admin.loadError': 'Failed to load payments',
  'payments.admin.noPayments': 'No payments found',
  'payments.admin.createFirstPayment': 'Create your first payment to get started.',
  'payments.admin.noFilteredPayments': 'No payments match your filters',
  'payments.admin.adjustFilters': 'Try adjusting your search or filter criteria.',
  'payments.admin.searchPlaceholder': 'Search by resident name, apartment, or description...',
  'payments.filter.allStatuses': 'All Statuses',
  'payments.status.paid': 'Paid',
  'payments.status.pending': 'Pending',
  'payments.status.overdue': 'Overdue',
  'payments.status.cancelled': 'Cancelled',
  'payments.dueDate': 'Due Date',
  'payments.description': 'Description',
};

describe('AdminPaymentManagement', () => {
  const mockT = jest.fn((key: string) => mockTranslations[key as keyof typeof mockTranslations] || key);

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders access denied for non-admin users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.RESIDENT,
    });

    render(<AdminPaymentManagement />);

    expect(screen.getByText('Access denied. Admin privileges required.')).toBeInTheDocument();
    expect(screen.getByText('Administrator privileges required to manage payments.')).toBeInTheDocument();
  });

  it('renders loading state for admin users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AdminPaymentManagement />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders payment management interface for admin users', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('Payment Management')).toBeInTheDocument();
    });

    expect(screen.getByText('Manage resident payments and fees')).toBeInTheDocument();
    expect(screen.getByText('Create Payment')).toBeInTheDocument();
  });

  it('renders payment table with data', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getAllByText('Monthly maintenance fee - January 2024')).toHaveLength(2);
    expect(screen.getAllByText('$150.00')).toHaveLength(2);
    
    // Check status badges (using more specific selectors to avoid dropdown options)
    const statusBadges = document.querySelectorAll('.px-2.py-1.rounded-full');
    expect(statusBadges).toHaveLength(2);
    expect(statusBadges[0]).toHaveTextContent('Pending');
    expect(statusBadges[1]).toHaveTextContent('Paid');
  });

  it('handles fetch error gracefully', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load payments')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('filters payments by status', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Filter by paid status
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'paid' } });

    // Should only show paid payment
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('searches payments by resident name', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Search for John
    const searchInput = screen.getByPlaceholderText('Search by resident name, apartment, or description...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Should only show John's payment
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
  });

  it('opens create payment form when create button is clicked', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Payment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Payment'));

    expect(screen.getByTestId('create-payment-form')).toBeInTheDocument();
    expect(screen.getByText('Create Payment Form')).toBeInTheDocument();
    expect(screen.getByText('Users: 2')).toBeInTheDocument();
  });

  it('opens payment status update when update status is clicked', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getAllByText('Update Status')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('Update Status')[0]);

    expect(screen.getByTestId('payment-status-update')).toBeInTheDocument();
    expect(screen.getByText('Update Status for: Monthly maintenance fee - January 2024')).toBeInTheDocument();
  });

  it('refreshes payments after successful payment creation', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [...mockPayments, { ...mockPayments[0], id: '3' }],
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('Create Payment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Payment'));
    fireEvent.click(screen.getByText('Success'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3); // Initial load + refresh
    });

    expect(screen.queryByTestId('create-payment-form')).not.toBeInTheDocument();
  });

  it('refreshes payments after successful status update', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getAllByText('Update Status')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('Update Status')[0]);
    fireEvent.click(screen.getByText('Success'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3); // Initial load + refresh
    });

    expect(screen.queryByTestId('payment-status-update')).not.toBeInTheDocument();
  });

  it('renders empty state when no payments exist', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('No payments found')).toBeInTheDocument();
    });

    expect(screen.getByText('Create your first payment to get started.')).toBeInTheDocument();
  });

  it('renders no filtered payments message when filters return no results', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Search for non-existent user
    const searchInput = screen.getByPlaceholderText('Search by resident name, apartment, or description...');
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });

    expect(screen.getByText('No payments match your filters')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filter criteria.')).toBeInTheDocument();
  });

  it('works for vigilance committee members', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.VIGILANCE,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(screen.getByText('Payment Management')).toBeInTheDocument();
    });

    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });

  it('makes correct API calls', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      userRole: UserRole.ADMIN,
    });
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPayments,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockUsers }),
      });

    render(<AdminPaymentManagement />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/payments`,
        {
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    expect(fetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/users`,
      {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      }
    );
  });
});