import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { NotificationCenter } from '../NotificationCenter';
import { useAuth } from '../../../contexts/AuthContext';
import { Notification } from '@home-management/types';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockTranslation = {
  t: (key: string, options?: any) => {
    const translations: Record<string, string> = {
      'notifications.title': 'Notifications',
      'notifications.empty': 'No notifications',
      'notifications.all': 'All',
      'notifications.unread': 'Unread',
      'notifications.markAllRead': 'Mark all as read',
      'notifications.markRead': 'Mark as read',
      'notifications.justNow': 'Just now',
      'notifications.hoursAgo': `${options?.hours} hours ago`,
      'notifications.stats': `${options?.total} total, ${options?.unread} unread`,
      'notifications.priority.normal': 'Normal',
      'notifications.priority.high': 'High',
      'notifications.channels.push': 'Push',
      'notifications.channels.in_app': 'In-app',
      'common.close': 'Close',
    };
    return translations[key] || key;
  },
};

const mockUser = {
  uid: 'user-123',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    userId: 'user-123',
    type: 'reservation_confirmation',
    title: 'Reservation Confirmed',
    body: 'Your pool reservation is confirmed',
    status: 'sent',
    priority: 'normal',
    channels: ['push', 'in_app'],
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  },
  {
    id: 'notif-2',
    userId: 'user-123',
    type: 'payment_due',
    title: 'Payment Due',
    body: 'Your maintenance fee is due',
    status: 'sent',
    priority: 'high',
    channels: ['push', 'in_app', 'email'],
    retryCount: 0,
    maxRetries: 3,
    readAt: new Date('2024-01-15T11:00:00Z'),
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z'),
  },
];

describe('NotificationCenter', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue(mockTranslation);
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
  });

  it('should render notification center when open', () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNotifications),
    });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<NotificationCenter isOpen={false} onClose={jest.fn()} />);

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  it('should fetch notifications when opened', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNotifications),
    });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('should display notifications', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2, totalDelivered: 2 }),
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Reservation Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Payment Due')).toBeInTheDocument();
    });
  });

  it('should filter unread notifications', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockNotifications[0]]), // Only unread
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Unread')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Unread'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('unreadOnly=true'),
        expect.any(Object)
      );
    });
  });

  it('should mark notification as read', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Mark as read')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark as read'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notifications/notif-1/read',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  it('should mark all notifications as read', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Mark all as read'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notifications/read-all',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  it('should delete notification', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText('🗑️')[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('🗑️')[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notifications/notif-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  it('should close when close button is clicked', () => {
    const onClose = jest.fn();
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationCenter isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('✕'));

    expect(onClose).toHaveBeenCalled();
  });

  it('should show empty state when no notifications', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 0 }),
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin');
  });

  it('should display correct notification icons', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('📅')).toBeInTheDocument(); // Reservation icon
      expect(screen.getByText('💰')).toBeInTheDocument(); // Payment icon
    });
  });

  it('should display priority badges', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockNotifications),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalSent: 2 }),
      });

    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });
  });
});