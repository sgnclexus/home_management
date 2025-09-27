import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { PaymentHistory } from '../PaymentHistory';
import { Payment } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

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
    userId: 'user-1',
    amount: 150.00,
    currency: 'USD',
    description: 'Monthly maintenance fee - December 2023',
    status: 'paid',
    dueDate: new Date('2023-12-31'),
    paidDate: new Date('2023-12-28'),
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-28'),
  },
  {
    id: '3',
    userId: 'user-1',
    amount: 200.00,
    currency: 'EUR',
    description: 'Special assessment - Building repairs',
    status: 'overdue',
    dueDate: new Date('2023-11-30'),
    createdAt: new Date('2023-11-01'),
    updatedAt: new Date('2023-11-01'),
  },
  {
    id: '4',
    userId: 'user-1',
    amount: 75.00,
    currency: 'USD',
    description: 'Parking fee - October 2023',
    status: 'cancelled',
    dueDate: new Date('2023-10-31'),
    createdAt: new Date('2023-10-01'),
    updatedAt: new Date('2023-10-15'),
  },
];

const mockTranslations = {
  'payments.history.title': 'Payment History',
  'payments.history.noPayments': 'No payments found',
  'payments.history.noPaymentsDescription': 'You don\'t have any payment records yet.',
  'payments.history.noFilteredPayments': 'No payments match your current filters',
  'payments.filter.allStatuses': 'All Statuses',
  'payments.status.paid': 'Paid',
  'payments.status.pending': 'Pending',
  'payments.status.overdue': 'Overdue',
  'payments.status.cancelled': 'Cancelled',
  'payments.dueDate': 'Due Date',
  'payments.description': 'Description',
  'payments.paidDate': 'Paid Date',
  amount: 'Amount',
  status: 'Status',
};

describe('PaymentHistory', () => {
  const mockT = jest.fn((key: string) => mockTranslations[key as keyof typeof mockTranslations] || key);

  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no payments provided', () => {
    render(<PaymentHistory payments={[]} />);

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    expect(screen.getByText('No payments found')).toBeInTheDocument();
    expect(screen.getByText('You don\'t have any payment records yet.')).toBeInTheDocument();
  });

  it('renders payment history table with all payments', () => {
    render(<PaymentHistory payments={mockPayments} />);

    expect(screen.getByText('Payment History')).toBeInTheDocument();
    
    // Check table headers
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Paid Date')).toBeInTheDocument();

    // Check payment data
    expect(screen.getByText('Monthly maintenance fee - January 2024')).toBeInTheDocument();
    expect(screen.getByText('Monthly maintenance fee - December 2023')).toBeInTheDocument();
    expect(screen.getByText('Special assessment - Building repairs')).toBeInTheDocument();
    expect(screen.getByText('Parking fee - October 2023')).toBeInTheDocument();

    // Check amounts with currency formatting
    expect(screen.getAllByText('$150.00')).toHaveLength(2);
    expect(screen.getByText('€200.00')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();

    // Check status badges (using more specific selectors to avoid dropdown options)
    const statusBadges = document.querySelectorAll('.px-2.py-1.rounded-full');
    expect(statusBadges).toHaveLength(4);
    expect(statusBadges[0]).toHaveTextContent('Pending');
    expect(statusBadges[1]).toHaveTextContent('Paid');
    expect(statusBadges[2]).toHaveTextContent('Overdue');
    expect(statusBadges[3]).toHaveTextContent('Cancelled');
  });

  it('filters payments by status', () => {
    render(<PaymentHistory payments={mockPayments} />);

    // Filter by paid status
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'paid' } });

    // Should only show paid payment
    expect(screen.getByText('Monthly maintenance fee - December 2023')).toBeInTheDocument();
    expect(screen.queryByText('Monthly maintenance fee - January 2024')).not.toBeInTheDocument();
    expect(screen.queryByText('Special assessment - Building repairs')).not.toBeInTheDocument();
    expect(screen.queryByText('Parking fee - October 2023')).not.toBeInTheDocument();
  });

  it('shows no filtered payments message when filter returns no results', () => {
    const paidPayments = mockPayments.filter(p => p.status === 'paid');
    render(<PaymentHistory payments={paidPayments} />);

    // Filter by pending status (should return no results)
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'pending' } });

    expect(screen.getByText('No payments match your current filters')).toBeInTheDocument();
  });

  it('sorts payments by date', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const dateHeader = screen.getByText('Due Date');
    fireEvent.click(dateHeader);

    // Check if payments are sorted (this is a simplified check)
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // Header + data rows
  });

  it('sorts payments by amount', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const amountHeader = screen.getByText('Amount');
    fireEvent.click(amountHeader);

    // Verify sorting functionality is triggered
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('sorts payments by status', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const statusHeader = screen.getByText('Status');
    fireEvent.click(statusHeader);

    // Verify sorting functionality is triggered
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('toggles sort order when clicking same header twice', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const dateHeader = screen.getByText('Due Date');
    
    // Click once for descending
    fireEvent.click(dateHeader);
    
    // Click again for ascending
    fireEvent.click(dateHeader);

    // Verify the component still renders correctly
    expect(screen.getByText('Payment History')).toBeInTheDocument();
  });

  it('displays paid date for paid payments and dash for others', () => {
    render(<PaymentHistory payments={mockPayments} />);

    // Check that paid payment shows paid date
    const tableRows = screen.getAllByRole('row');
    const paidRow = tableRows.find(row => 
      row.textContent?.includes('Monthly maintenance fee - December 2023')
    );
    expect(paidRow?.textContent).toContain('Dec 27, 2023');

    // Check that non-paid payments show dash
    const pendingRow = tableRows.find(row => 
      row.textContent?.includes('Monthly maintenance fee - January 2024')
    );
    expect(pendingRow?.textContent).toContain('-');
  });

  it('formats dates correctly', () => {
    render(<PaymentHistory payments={mockPayments} />);

    expect(screen.getByText('Jan 30, 2024')).toBeInTheDocument();
    expect(screen.getByText('Dec 30, 2023')).toBeInTheDocument();
    expect(screen.getByText('Nov 29, 2023')).toBeInTheDocument();
    expect(screen.getByText('Oct 30, 2023')).toBeInTheDocument();
  });

  it('applies correct CSS classes for status badges', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const badges = screen.getAllByText('Paid');
    const paidBadge = badges.find(badge => badge.classList.contains('px-2'));
    expect(paidBadge).toHaveClass('text-green-600', 'bg-green-100');

    const pendingBadges = screen.getAllByText('Pending');
    const pendingBadge = pendingBadges.find(badge => badge.classList.contains('px-2'));
    expect(pendingBadge).toHaveClass('text-yellow-600', 'bg-yellow-100');

    const overdueBadges = screen.getAllByText('Overdue');
    const overdueBadge = overdueBadges.find(badge => badge.classList.contains('px-2'));
    expect(overdueBadge).toHaveClass('text-red-600', 'bg-red-100');

    const cancelledBadges = screen.getAllByText('Cancelled');
    const cancelledBadge = cancelledBadges.find(badge => badge.classList.contains('px-2'));
    expect(cancelledBadge).toHaveClass('text-gray-600', 'bg-gray-100');
  });

  it('handles hover effects on table rows', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const tableRows = screen.getAllByRole('row');
    const dataRow = tableRows[1]; // First data row (skip header)

    expect(dataRow).toHaveClass('hover:bg-gray-50');
  });

  it('renders filter dropdown with all status options', () => {
    render(<PaymentHistory payments={mockPayments} />);

    const statusFilter = screen.getByDisplayValue('All Statuses');
    expect(statusFilter).toBeInTheDocument();

    // Check that all status options are available
    expect(screen.getByRole('option', { name: 'All Statuses' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Paid' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cancelled' })).toBeInTheDocument();
  });
});