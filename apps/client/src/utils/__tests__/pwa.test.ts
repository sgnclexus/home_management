import {
  pwaManager,
  pushNotificationManager,
  networkStatusManager,
  offlineStorageManager,
} from '../pwa';

// Mock global objects
const mockServiceWorkerRegistration = {
  pushManager: {
    subscribe: jest.fn(),
    getSubscription: jest.fn(),
  },
  showNotification: jest.fn(),
};

const mockServiceWorker = {
  ready: Promise.resolve(mockServiceWorkerRegistration),
  register: jest.fn(),
  addEventListener: jest.fn(),
};

const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: jest.fn(),
};

// Setup global mocks
Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: mockServiceWorker,
    onLine: true,
  },
  writable: true,
});

Object.defineProperty(global, 'Notification', {
  value: mockNotification,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    addEventListener: jest.fn(),
    matchMedia: jest.fn(() => ({ matches: false })),
    atob: jest.fn((str) => Buffer.from(str, 'base64').toString('binary')),
  },
  writable: true,
});

Object.defineProperty(global, 'indexedDB', {
  value: {
    open: jest.fn(() => ({
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: { contains: jest.fn(() => false) },
        createObjectStore: jest.fn(() => ({
          createIndex: jest.fn(),
        })),
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            add: jest.fn(() => ({ onsuccess: null, onerror: null })),
            get: jest.fn(() => ({ onsuccess: null, onerror: null })),
            getAll: jest.fn(() => ({ onsuccess: null, onerror: null })),
            delete: jest.fn(() => ({ onsuccess: null, onerror: null })),
            put: jest.fn(() => ({ onsuccess: null, onerror: null })),
          })),
        })),
      },
    })),
  },
  writable: true,
});

describe('PWA Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PWA Install Manager', () => {
    it('should initialize without errors', () => {
      expect(pwaManager).toBeDefined();
    });

    it('should handle install prompt events', () => {
      const callback = jest.fn();
      const unsubscribe = pwaManager.onInstallPromptChange(callback);

      expect(callback).toHaveBeenCalledWith({
        isInstallable: false,
        isInstalled: false,
        showInstallPrompt: expect.any(Function),
        dismissInstallPrompt: expect.any(Function),
      });

      unsubscribe();
    });

    it('should get install status', () => {
      const status = pwaManager.getInstallStatus();
      
      expect(status).toEqual({
        isInstallable: false,
        isInstalled: false,
        showInstallPrompt: expect.any(Function),
        dismissInstallPrompt: expect.any(Function),
      });
    });
  });

  describe('Push Notification Manager', () => {
    beforeEach(() => {
      mockNotification.permission = 'default';
      mockNotification.requestPermission.mockResolvedValue('granted');
      mockServiceWorkerRegistration.pushManager.subscribe.mockResolvedValue({
        endpoint: 'https://example.com/push',
        keys: {
          p256dh: 'test-key',
          auth: 'test-auth',
        },
      });
    });

    it('should initialize push notification manager', async () => {
      await expect(pushNotificationManager.initialize()).resolves.toBeUndefined();
    });

    it('should request notification permission', async () => {
      const permission = await pushNotificationManager.requestPermission();
      expect(permission).toBe('granted');
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });

    it('should subscribe to push notifications', async () => {
      const vapidKey = 'test-vapid-key';
      const subscription = await pushNotificationManager.subscribeToPush(vapidKey);
      
      expect(subscription).toEqual({
        endpoint: 'https://example.com/push',
        keys: {
          p256dh: 'test-key',
          auth: 'test-auth',
        },
      });
    });

    it('should handle subscription errors gracefully', async () => {
      mockServiceWorkerRegistration.pushManager.subscribe.mockRejectedValue(
        new Error('Subscription failed')
      );

      const subscription = await pushNotificationManager.subscribeToPush('test-key');
      expect(subscription).toBeNull();
    });

    it('should unsubscribe from push notifications', async () => {
      const mockSubscription = {
        unsubscribe: jest.fn().mockResolvedValue(true),
      };
      mockServiceWorkerRegistration.pushManager.getSubscription.mockResolvedValue(mockSubscription);

      const result = await pushNotificationManager.unsubscribeFromPush();
      expect(result).toBe(true);
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Network Status Manager', () => {
    it('should initialize with current network status', () => {
      expect(networkStatusManager.getNetworkStatus()).toBe(true);
    });

    it('should register network status change listeners', () => {
      const callback = jest.fn();
      const unsubscribe = networkStatusManager.onNetworkStatusChange(callback);

      expect(callback).toHaveBeenCalledWith(true);
      unsubscribe();
    });
  });

  describe('Offline Storage Manager', () => {
    let mockDB: any;
    let mockTransaction: any;
    let mockStore: any;

    beforeEach(() => {
      mockStore = {
        add: jest.fn(() => ({ onsuccess: null, onerror: null })),
        get: jest.fn(() => ({ onsuccess: null, onerror: null })),
        getAll: jest.fn(() => ({ onsuccess: null, onerror: null })),
        delete: jest.fn(() => ({ onsuccess: null, onerror: null })),
        put: jest.fn(() => ({ onsuccess: null, onerror: null })),
      };

      mockTransaction = {
        objectStore: jest.fn(() => mockStore),
      };

      mockDB = {
        transaction: jest.fn(() => mockTransaction),
        objectStoreNames: { contains: jest.fn(() => false) },
        createObjectStore: jest.fn(() => ({
          createIndex: jest.fn(),
        })),
      };

      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB,
      };

      (global.indexedDB.open as jest.Mock).mockReturnValue(mockRequest);
    });

    it('should initialize offline storage', async () => {
      const initPromise = offlineStorageManager.initialize();
      
      // Simulate successful database opening
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }

      await expect(initPromise).resolves.toBeUndefined();
    });

    it('should store offline actions', async () => {
      // Initialize first
      const initPromise = offlineStorageManager.initialize();
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
      await initPromise;

      const action = { type: 'payment', data: { amount: 100 } };
      const storePromise = offlineStorageManager.storeOfflineAction(action);

      // Simulate successful store operation
      const addRequest = mockStore.add.mock.results[0].value;
      if (addRequest.onsuccess) {
        addRequest.onsuccess();
      }

      await expect(storePromise).resolves.toBeUndefined();
      expect(mockStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment',
          data: { amount: 100 },
          id: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should retrieve offline actions', async () => {
      // Initialize first
      const initPromise = offlineStorageManager.initialize();
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
      await initPromise;

      const mockActions = [
        { id: '1', type: 'payment', data: { amount: 100 } },
        { id: '2', type: 'reservation', data: { areaId: 'gym' } },
      ];

      const getPromise = offlineStorageManager.getOfflineActions();

      // Simulate successful get operation
      const getAllRequest = mockStore.getAll.mock.results[0].value;
      getAllRequest.result = mockActions;
      if (getAllRequest.onsuccess) {
        getAllRequest.onsuccess();
      }

      const result = await getPromise;
      expect(result).toEqual(mockActions);
    });

    it('should cache data with TTL', async () => {
      // Initialize first
      const initPromise = offlineStorageManager.initialize();
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
      await initPromise;

      const key = 'test-key';
      const data = { value: 'test-data' };
      const ttlMinutes = 30;

      const cachePromise = offlineStorageManager.cacheData(key, data, ttlMinutes);

      // Simulate successful cache operation
      const putRequest = mockStore.put.mock.results[0].value;
      if (putRequest.onsuccess) {
        putRequest.onsuccess();
      }

      await expect(cachePromise).resolves.toBeUndefined();
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key,
          data,
          expiry: expect.any(Number),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should retrieve cached data if not expired', async () => {
      // Initialize first
      const initPromise = offlineStorageManager.initialize();
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
      await initPromise;

      const key = 'test-key';
      const cachedData = {
        key,
        data: { value: 'test-data' },
        expiry: Date.now() + 60000, // 1 minute from now
        timestamp: Date.now(),
      };

      const getPromise = offlineStorageManager.getCachedData(key);

      // Simulate successful get operation
      const getRequest = mockStore.get.mock.results[0].value;
      getRequest.result = cachedData;
      if (getRequest.onsuccess) {
        getRequest.onsuccess();
      }

      const result = await getPromise;
      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for expired cached data', async () => {
      // Initialize first
      const initPromise = offlineStorageManager.initialize();
      const mockRequest = (global.indexedDB.open as jest.Mock).mock.results[0].value;
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess();
      }
      await initPromise;

      const key = 'test-key';
      const expiredData = {
        key,
        data: { value: 'test-data' },
        expiry: Date.now() - 60000, // 1 minute ago
        timestamp: Date.now() - 120000,
      };

      const getPromise = offlineStorageManager.getCachedData(key);

      // Simulate successful get operation
      const getRequest = mockStore.get.mock.results[0].value;
      getRequest.result = expiredData;
      if (getRequest.onsuccess) {
        getRequest.onsuccess();
      }

      const result = await getPromise;
      expect(result).toBeNull();
    });
  });
});