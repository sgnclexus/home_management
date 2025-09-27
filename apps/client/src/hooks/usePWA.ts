import { useState, useEffect } from 'react';
import { 
  pwaManager, 
  pushNotificationManager, 
  networkStatusManager,
  offlineStorageManager,
  PWAInstallPrompt 
} from '../utils/pwa';

// Hook for PWA installation
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt>({
    isInstallable: false,
    isInstalled: false,
    showInstallPrompt: async () => {},
    dismissInstallPrompt: () => {},
  });

  useEffect(() => {
    const unsubscribe = pwaManager.onInstallPromptChange(setInstallPrompt);
    return unsubscribe;
  }, []);

  return installPrompt;
}

// Hook for push notifications
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize permission state
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Initialize push notification manager and get existing subscription
    const initializePushNotifications = async () => {
      try {
        await pushNotificationManager.initialize();
        const existingSubscription = await pushNotificationManager.getSubscription();
        setSubscription(existingSubscription);
      } catch (err) {
        console.error('Failed to initialize push notifications:', err);
      }
    };

    initializePushNotifications();
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    setIsLoading(true);
    setError(null);

    try {
      const newPermission = await pushNotificationManager.requestPermission();
      setPermission(newPermission);
      return newPermission;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request permission';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = async (vapidPublicKey: string): Promise<PushSubscription | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission first if not granted
      if (permission !== 'granted') {
        const newPermission = await requestPermission();
        if (newPermission !== 'granted') {
          throw new Error('Notification permission not granted');
        }
      }

      const newSubscription = await pushNotificationManager.subscribeToPush(vapidPublicKey);
      setSubscription(newSubscription);
      return newSubscription;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await pushNotificationManager.unsubscribeFromPush();
      if (success) {
        setSubscription(null);
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    permission,
    subscription,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window,
  };
}

// Hook for network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = networkStatusManager.onNetworkStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}

// Hook for offline storage
export function useOfflineStorage() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStorage = async () => {
      try {
        await offlineStorageManager.initialize();
        setIsInitialized(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize offline storage';
        setError(errorMessage);
      }
    };

    initializeStorage();
  }, []);

  const storeOfflineAction = async (action: any): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized');
    }
    return offlineStorageManager.storeOfflineAction(action);
  };

  const getOfflineActions = async (): Promise<any[]> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized');
    }
    return offlineStorageManager.getOfflineActions();
  };

  const removeOfflineAction = async (id: string): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized');
    }
    return offlineStorageManager.removeOfflineAction(id);
  };

  const cacheData = async (key: string, data: any, ttlMinutes?: number): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized');
    }
    return offlineStorageManager.cacheData(key, data, ttlMinutes);
  };

  const getCachedData = async (key: string): Promise<any | null> => {
    if (!isInitialized) {
      throw new Error('Offline storage not initialized');
    }
    return offlineStorageManager.getCachedData(key);
  };

  return {
    isInitialized,
    error,
    storeOfflineAction,
    getOfflineActions,
    removeOfflineAction,
    cacheData,
    getCachedData,
  };
}

// Hook for PWA update detection
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page when a new service worker takes control
        window.location.reload();
      });

      // Listen for service worker updates
      navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });
    }
  }, []);

  const applyUpdate = async (): Promise<void> => {
    if (!updateAvailable) return;

    setIsUpdating(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        // Tell the waiting service worker to skip waiting and become active
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('Failed to apply update:', error);
      setIsUpdating(false);
    }
  };

  return {
    updateAvailable,
    isUpdating,
    applyUpdate,
  };
}