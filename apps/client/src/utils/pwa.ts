// PWA utility functions for Home Management app

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAInstallPrompt {
  isInstallable: boolean;
  isInstalled: boolean;
  showInstallPrompt: () => Promise<void>;
  dismissInstallPrompt: () => void;
}

class PWAManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private installPromptCallbacks: Array<(prompt: PWAInstallPrompt) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    // Check if app is already installed
    this.checkInstallStatus();

    // Listen for beforeinstallprompt event
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e as BeforeInstallPromptEvent;
        this.notifyInstallPromptListeners();
      });

      // Listen for app installed event
      window.addEventListener('appinstalled', () => {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notifyInstallPromptListeners();
      });
    }
  }

  private checkInstallStatus() {
    // Check if running in standalone mode (installed)
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        this.isInstalled = true;
      }
    }

    // Check if running as PWA on iOS
    if (typeof window !== 'undefined' && (window.navigator as any).standalone === true) {
      this.isInstalled = true;
    }
  }

  private notifyInstallPromptListeners() {
    const prompt: PWAInstallPrompt = {
      isInstallable: !!this.deferredPrompt,
      isInstalled: this.isInstalled,
      showInstallPrompt: this.showInstallPrompt.bind(this),
      dismissInstallPrompt: this.dismissInstallPrompt.bind(this),
    };

    this.installPromptCallbacks.forEach(callback => callback(prompt));
  }

  public onInstallPromptChange(callback: (prompt: PWAInstallPrompt) => void) {
    this.installPromptCallbacks.push(callback);
    
    // Immediately call with current state
    this.notifyInstallPromptListeners();

    // Return unsubscribe function
    return () => {
      const index = this.installPromptCallbacks.indexOf(callback);
      if (index > -1) {
        this.installPromptCallbacks.splice(index, 1);
      }
    };
  }

  public async showInstallPrompt(): Promise<void> {
    if (!this.deferredPrompt) {
      throw new Error('Install prompt not available');
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    } finally {
      this.deferredPrompt = null;
      this.notifyInstallPromptListeners();
    }
  }

  public dismissInstallPrompt(): void {
    this.deferredPrompt = null;
    this.notifyInstallPromptListeners();
  }

  public getInstallStatus(): PWAInstallPrompt {
    return {
      isInstallable: !!this.deferredPrompt,
      isInstalled: this.isInstalled,
      showInstallPrompt: this.showInstallPrompt.bind(this),
      dismissInstallPrompt: this.dismissInstallPrompt.bind(this),
    };
  }
}

// Singleton instance
export const pwaManager = new PWAManager();

// Push notification utilities
export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
    } catch (error) {
      console.error('Service worker not ready:', error);
      throw error;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    return permission;
  }

  async subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      throw new Error('Service worker registration not available');
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        return await subscription.unsubscribe();
      }
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initialize();
    }

    if (!this.registration) {
      return null;
    }

    try {
      return await this.registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Singleton instance
export const pushNotificationManager = new PushNotificationManager();

// Offline storage utilities
export class OfflineStorageManager {
  private dbName = 'HomeManagementOffline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores for offline data
        if (!db.objectStoreNames.contains('offlineActions')) {
          const actionStore = db.createObjectStore('offlineActions', { keyPath: 'id' });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
          actionStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains('cachedData')) {
          const dataStore = db.createObjectStore('cachedData', { keyPath: 'key' });
          dataStore.createIndex('expiry', 'expiry', { unique: false });
        }
      };
    });
  }

  async storeOfflineAction(action: any): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
    const store = transaction.objectStore('offlineActions');
    
    const actionWithId = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.add(actionWithId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineActions(): Promise<any[]> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['offlineActions'], 'readonly');
    const store = transaction.objectStore('offlineActions');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeOfflineAction(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['offlineActions'], 'readwrite');
    const store = transaction.objectStore('offlineActions');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cacheData(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['cachedData'], 'readwrite');
    const store = transaction.objectStore('cachedData');
    
    const cachedItem = {
      key,
      data,
      expiry: Date.now() + (ttlMinutes * 60 * 1000),
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cachedItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.initialize();
    
    const transaction = this.db!.transaction(['cachedData'], 'readonly');
    const store = transaction.objectStore('cachedData');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (!result || result.expiry < Date.now()) {
          resolve(null);
        } else {
          resolve(result.data);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const offlineStorageManager = new OfflineStorageManager();

// Network status utilities
export class NetworkStatusManager {
  private listeners: Array<(isOnline: boolean) => void> = [];
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  public onNetworkStatusChange(callback: (isOnline: boolean) => void) {
    this.listeners.push(callback);
    
    // Immediately call with current status
    callback(this.isOnline);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getNetworkStatus(): boolean {
    return this.isOnline;
  }
}

// Singleton instance
export const networkStatusManager = new NetworkStatusManager();