import { renderHook, act } from '@testing-library/react';
import { usePWAInstall, usePushNotifications, useNetworkStatus, useOfflineStorage, usePWAUpdate } from '../usePWA';

// Mock the PWA utilities
jest.mock('../../utils/pwa', () => ({
  pwaManager: {
    onInstallPromptChange: jest.fn((callback) => {
      callback({
        isInstallable: false,
        isInstalled: false,
        showInstallPrompt: jest.fn(),
        dismissInstallPrompt: jest.fn(),
      });
      return jest.fn(); // unsubscribe function
    }),
  },
  pushNotificationManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('granted'),
    subscribeToPush: jest.fn().mockResolvedValue({
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'test', auth: 'test' },
    }),
    unsubscribeFromPush: jest.fn().mockResolvedValue(true),
    getSubscription: jest.fn().mockResolvedValue(null),
  },
  networkStatusManager: {
    onNetworkStatusChange: jest.fn((callback) => {
      callback(true);
      return jest.fn(); // unsubscribe function
    }),
  },
  offlineStorageManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    storeOfflineAction: jest.fn().mockResolvedValue(undefined),
    getOfflineActions: jest.fn().mockResolvedValue([]),
    removeOfflineAction: jest.fn().mockResolvedValue(undefined),
    cacheData: jest.fn().mockResolvedValue(undefined),
    getCachedData: jest.fn().mockResolvedValue(null),
  },
}));

// Mock global objects
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    serviceWorker: {
      ready: Promise.resolve({}),
      addEventListener: jest.fn(),
    },
  },
  writable: true,
});

Object.defineProperty(global, 'Notification', {
  value: {
    permission: 'default',
  },
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    PushManager: {},
  },
  writable: true,
});

describe('PWA Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('usePWAInstall', () => {
    it('should return initial install prompt state', () => {
      const { result } = renderHook(() => usePWAInstall());

      expect(result.current).toEqual({
        isInstallable: false,
        isInstalled: false,
        showInstallPrompt: expect.any(Function),
        dismissInstallPrompt: expect.any(Function),
      });
    });

    it('should update when install prompt changes', () => {
      const { pwaManager } = require('../../utils/pwa');
      const mockCallback = pwaManager.onInstallPromptChange.mock.calls[0][0];

      renderHook(() => usePWAInstall());

      // Simulate install prompt becoming available
      act(() => {
        mockCallback({
          isInstallable: true,
          isInstalled: false,
          showInstallPrompt: jest.fn(),
          dismissInstallPrompt: jest.fn(),
        });
      });

      expect(pwaManager.onInstallPromptChange).toHaveBeenCalled();
    });
  });

  describe('usePushNotifications', () => {
    it('should return initial push notification state', () => {
      const { result } = renderHook(() => usePushNotifications());

      expect(result.current).toEqual({
        permission: 'default',
        subscription: null,
        isLoading: false,
        error: null,
        requestPermission: expect.any(Function),
        subscribe: expect.any(Function),
        unsubscribe: expect.any(Function),
        isSupported: true,
      });
    });

    it('should request permission successfully', async () => {
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        const permission = await result.current.requestPermission();
        expect(permission).toBe('granted');
      });

      expect(result.current.permission).toBe('granted');
    });

    it('should subscribe to push notifications', async () => {
      const { result } = renderHook(() => usePushNotifications());
      const vapidKey = 'test-vapid-key';

      await act(async () => {
        const subscription = await result.current.subscribe(vapidKey);
        expect(subscription).toEqual({
          endpoint: 'https://example.com/push',
          keys: { p256dh: 'test', auth: 'test' },
        });
      });
    });

    it('should handle subscription errors', async () => {
      const { pushNotificationManager } = require('../../utils/pwa');
      pushNotificationManager.subscribeToPush.mockRejectedValue(new Error('Subscription failed'));

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        try {
          await result.current.subscribe('test-key');
        } catch (error) {
          expect(error.message).toBe('Subscription failed');
        }
      });

      expect(result.current.error).toBe('Subscription failed');
    });

    it('should unsubscribe from push notifications', async () => {
      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        const success = await result.current.unsubscribe();
        expect(success).toBe(true);
      });
    });
  });

  describe('useNetworkStatus', () => {
    it('should return initial network status', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current).toEqual({
        isOnline: true,
        isOffline: false,
      });
    });

    it('should update when network status changes', () => {
      const { networkStatusManager } = require('../../utils/pwa');
      const mockCallback = networkStatusManager.onNetworkStatusChange.mock.calls[0][0];

      const { result } = renderHook(() => useNetworkStatus());

      // Simulate going offline
      act(() => {
        mockCallback(false);
      });

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe('useOfflineStorage', () => {
    it('should return initial offline storage state', () => {
      const { result } = renderHook(() => useOfflineStorage());

      expect(result.current).toEqual({
        isInitialized: false,
        error: null,
        storeOfflineAction: expect.any(Function),
        getOfflineActions: expect.any(Function),
        removeOfflineAction: expect.any(Function),
        cacheData: expect.any(Function),
        getCachedData: expect.any(Function),
      });
    });

    it('should initialize offline storage', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useOfflineStorage());

      await waitForNextUpdate();

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle initialization errors', async () => {
      const { offlineStorageManager } = require('../../utils/pwa');
      offlineStorageManager.initialize.mockRejectedValue(new Error('Init failed'));

      const { result, waitForNextUpdate } = renderHook(() => useOfflineStorage());

      await waitForNextUpdate();

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBe('Init failed');
    });

    it('should store offline actions', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useOfflineStorage());

      await waitForNextUpdate(); // Wait for initialization

      const action = { type: 'payment', data: { amount: 100 } };

      await act(async () => {
        await result.current.storeOfflineAction(action);
      });

      const { offlineStorageManager } = require('../../utils/pwa');
      expect(offlineStorageManager.storeOfflineAction).toHaveBeenCalledWith(action);
    });

    it('should throw error when not initialized', async () => {
      const { offlineStorageManager } = require('../../utils/pwa');
      offlineStorageManager.initialize.mockRejectedValue(new Error('Init failed'));

      const { result, waitForNextUpdate } = renderHook(() => useOfflineStorage());

      await waitForNextUpdate();

      await act(async () => {
        try {
          await result.current.storeOfflineAction({ type: 'test' });
        } catch (error) {
          expect(error.message).toBe('Offline storage not initialized');
        }
      });
    });
  });

  describe('usePWAUpdate', () => {
    it('should return initial update state', () => {
      const { result } = renderHook(() => usePWAUpdate());

      expect(result.current).toEqual({
        updateAvailable: false,
        isUpdating: false,
        applyUpdate: expect.any(Function),
      });
    });

    it('should handle service worker updates', () => {
      const mockRegistration = {
        addEventListener: jest.fn(),
        waiting: {
          postMessage: jest.fn(),
        },
      };

      Object.defineProperty(global.navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve(mockRegistration),
          addEventListener: jest.fn(),
        },
        writable: true,
      });

      renderHook(() => usePWAUpdate());

      expect(global.navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function)
      );
    });
  });
});