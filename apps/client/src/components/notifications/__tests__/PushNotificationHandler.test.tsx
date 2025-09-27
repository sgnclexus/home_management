import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTranslation } from 'next-i18next';
import { PushNotificationHandler, usePushNotifications } from '../PushNotificationHandler';
import { useAuth } from '../../../contexts/AuthContext';

// Mock dependencies
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock Notification API
const mockNotification = {
  requestPermission: jest.fn(),
  permission: 'default' as NotificationPermission,
};

Object.defineProperty(window, 'Notification', {
  value: mockNotification,
  writable: true,
});

// Mock Service Worker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: jest.fn(),
  },
  writable: true,
});

const mockTranslation = {
  t: (key: string) => {
    const translations: Record<string, string> = {
      'notifications.permission.title': 'Enable Notifications',
      'notifications.permission.description': 'Get notified about important updates',
      'notifications.permission.allow': 'Allow',
      'notifications.permission.dismiss': 'Dismiss',
      'common.loading': 'Loading...',
      'common.close': 'Close',
    };
    return translations[key] || key;
  },
};

const mockUser = {
  uid: 'user-123',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

describe('PushNotificationHandler', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue(mockTranslation);
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
    mockNotification.requestPermission.mockClear();
    mockNotification.permission = 'default';
    (navigator.serviceWorker.register as jest.Mock).mockClear();
  });

  it('should show permission prompt when permission is default and user is logged in', () => {
    render(<PushNotificationHandler />);

    expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    expect(screen.getByText('Get notified about important updates')).toBeInTheDocument();
    expect(screen.getByText('Allow')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should not show prompt when permission is already granted', () => {
    mockNotification.permission = 'granted';

    render(<PushNotificationHandler />);

    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();
  });

  it('should not show prompt when permission is denied', () => {
    mockNotification.permission = 'denied';

    render(<PushNotificationHandler />);

    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();
  });

  it('should not show prompt when user is not logged in', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<PushNotificationHandler />);

    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();
  });

  it('should request permission when allow button is clicked', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    (navigator.serviceWorker.register as jest.Mock).mockResolvedValue({});
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    const onPermissionGranted = jest.fn();

    render(<PushNotificationHandler onPermissionGranted={onPermissionGranted} />);

    fireEvent.click(screen.getByText('Allow'));

    await waitFor(() => {
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(onPermissionGranted).toHaveBeenCalled();
  });

  it('should call onPermissionDenied when permission is denied', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied');

    const onPermissionDenied = jest.fn();

    render(<PushNotificationHandler onPermissionDenied={onPermissionDenied} />);

    fireEvent.click(screen.getByText('Allow'));

    await waitFor(() => {
      expect(onPermissionDenied).toHaveBeenCalled();
    });
  });

  it('should dismiss prompt when dismiss button is clicked', () => {
    render(<PushNotificationHandler />);

    fireEvent.click(screen.getByText('Dismiss'));

    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();
  });

  it('should dismiss prompt when close button is clicked', () => {
    render(<PushNotificationHandler />);

    fireEvent.click(screen.getByText('✕'));

    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();
  });

  it('should show loading state while requesting permission', async () => {
    mockNotification.requestPermission.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<PushNotificationHandler />);

    fireEvent.click(screen.getByText('Allow'));

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('should handle service worker registration failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockNotification.requestPermission.mockResolvedValue('granted');
    (navigator.serviceWorker.register as jest.Mock).mockRejectedValue(new Error('SW Error'));

    render(<PushNotificationHandler />);

    fireEvent.click(screen.getByText('Allow'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error requesting notification permission:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should handle browsers without notification support', () => {
    // Temporarily remove Notification from window
    const originalNotification = window.Notification;
    delete (window as any).Notification;

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(<PushNotificationHandler />);

    // Should not show prompt
    expect(screen.queryByText('Enable Notifications')).not.toBeInTheDocument();

    // Restore Notification
    (window as any).Notification = originalNotification;
    consoleSpy.mockRestore();
  });
});

describe('usePushNotifications', () => {
  const TestComponent = () => {
    const { permission, fcmToken, requestPermission, showNotification, isSupported } = usePushNotifications();
    
    return (
      <div>
        <span data-testid="permission">{permission}</span>
        <span data-testid="token">{fcmToken || 'none'}</span>
        <span data-testid="supported">{isSupported.toString()}</span>
        <button onClick={requestPermission} data-testid="request">Request</button>
        <button onClick={() => showNotification('Test')} data-testid="show">Show</button>
      </div>
    );
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (fetch as jest.Mock).mockClear();
    mockNotification.requestPermission.mockClear();
    mockNotification.permission = 'default';
  });

  it('should return current permission status', () => {
    mockNotification.permission = 'granted';

    render(<TestComponent />);

    expect(screen.getByTestId('permission')).toHaveTextContent('granted');
  });

  it('should return browser support status', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('supported')).toHaveTextContent('true');
  });

  it('should request permission and return token', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('request'));

    await waitFor(() => {
      expect(screen.getByTestId('permission')).toHaveTextContent('granted');
      expect(screen.getByTestId('token')).not.toHaveTextContent('none');
    });
  });

  it('should throw error when permission is denied', async () => {
    mockNotification.requestPermission.mockResolvedValue('denied');

    render(<TestComponent />);

    await expect(async () => {
      fireEvent.click(screen.getByTestId('request'));
      await waitFor(() => {
        expect(mockNotification.requestPermission).toHaveBeenCalled();
      });
    }).rejects.toThrow();
  });

  it('should show notification when permission is granted', async () => {
    mockNotification.permission = 'granted';
    const NotificationConstructor = jest.fn();
    (window as any).Notification = NotificationConstructor;

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('show'));

    expect(NotificationConstructor).toHaveBeenCalledWith('Test', undefined);
  });

  it('should throw error when showing notification without permission', () => {
    mockNotification.permission = 'denied';

    render(<TestComponent />);

    expect(() => {
      fireEvent.click(screen.getByTestId('show'));
    }).toThrow('Notification permission not granted');
  });

  it('should update FCM token on server', async () => {
    mockNotification.requestPermission.mockResolvedValue('granted');
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('request'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/users/fcm-token',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          },
          body: expect.stringContaining('mock-fcm-token'),
        })
      );
    });
  });
});