import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationBadge, useNotificationBadge } from '../NotificationBadge';
import { useAuth } from '../../../contexts/AuthContext';

// Mock dependencies
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockUser = {
  uid: 'user-123',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

describe('NotificationBadge', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render notification bell icon', () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationBadge />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('should fetch unread count on mount', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }, { id: '2' }]),
    });

    render(<NotificationBadge />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notifications?unreadOnly=true',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('should display unread count badge', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }, { id: '2' }, { id: '3' }]),
    });

    render(<NotificationBadge />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should display 99+ for counts over 99', async () => {
    const notifications = Array.from({ length: 150 }, (_, i) => ({ id: i.toString() }));
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(notifications),
    });

    render(<NotificationBadge />);

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  it('should not display badge when count is 0', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationBadge />);

    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });

  it('should call onClick when clicked', async () => {
    const onClick = jest.fn();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationBadge onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalled();
  });

  it('should poll for updates every 30 seconds', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationBadge />);

    // Initial call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    // Advance timer by 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    // Advance timer by another 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  it('should show loading indicator while fetching', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NotificationBadge />);

    expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin');
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<NotificationBadge />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch unread count:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should not fetch when user is not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<NotificationBadge />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<NotificationBadge className="custom-class" />);

    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });
});

describe('useNotificationBadge', () => {
  const TestComponent = () => {
    const { unreadCount, loading, markAllAsRead, decrementCount, incrementCount } = useNotificationBadge();
    
    return (
      <div>
        <span data-testid="count">{unreadCount}</span>
        <span data-testid="loading">{loading.toString()}</span>
        <button onClick={markAllAsRead} data-testid="mark-all">Mark All</button>
        <button onClick={() => decrementCount()} data-testid="decrement">Decrement</button>
        <button onClick={() => incrementCount()} data-testid="increment">Increment</button>
      </div>
    );
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return unread count', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }, { id: '2' }]),
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  it('should mark all as read', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByTestId('mark-all'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/notifications/read-all',
        expect.objectContaining({
          method: 'PUT',
        })
      );
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
  });

  it('should decrement count', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }, { id: '2' }, { id: '3' }]),
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('3');
    });

    fireEvent.click(screen.getByTestId('decrement'));

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('should increment count', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }]),
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByTestId('increment'));

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('should not decrement below 0', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    fireEvent.click(screen.getByTestId('decrement'));

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});