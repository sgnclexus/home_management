import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../contexts/AuthContext';

interface PushNotificationHandlerProps {
  onPermissionGranted?: (token: string) => void;
  onPermissionDenied?: () => void;
}

export const PushNotificationHandler: React.FC<PushNotificationHandlerProps> = ({
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = () => {
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      
      // Show prompt if permission is default and user is logged in
      if (currentPermission === 'default' && user) {
        setShowPrompt(true);
      }
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    setLoading(true);
    
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        await registerServiceWorker();
        setShowPrompt(false);
        onPermissionGranted?.(await getFCMToken());
      } else {
        setShowPrompt(false);
        onPermissionDenied?.();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    }
  };

  const getFCMToken = async (): Promise<string> => {
    // This would integrate with Firebase Cloud Messaging
    // For now, return a mock token
    return 'mock-fcm-token-' + Date.now();
  };

  const updateUserFCMToken = async (token: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/users/fcm-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (!response.ok) {
        throw new Error('Failed to update FCM token');
      }
    } catch (error) {
      console.error('Failed to update FCM token:', error);
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">🔔</span>
        </div>
        
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            {t('notifications.permission.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('notifications.permission.description')}
          </p>
          
          <div className="mt-3 flex space-x-2">
            <button
              onClick={requestPermission}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  {t('common.loading')}
                </>
              ) : (
                t('notifications.permission.allow')
              )}
            </button>
            
            <button
              onClick={dismissPrompt}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('notifications.permission.dismiss')}
            </button>
          </div>
        </div>
        
        <button
          onClick={dismissPrompt}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">{t('common.close')}</span>
          ✕
        </button>
      </div>
    </div>
  );
};

// Hook for managing push notifications
export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    setPermission(permission);
    
    if (permission === 'granted') {
      const token = await getFCMToken();
      setFcmToken(token);
      
      if (user) {
        await updateUserFCMToken(token);
      }
      
      return token;
    }
    
    throw new Error('Permission denied');
  };

  const getFCMToken = async (): Promise<string> => {
    // This would integrate with Firebase Cloud Messaging
    // For now, return a mock token
    return 'mock-fcm-token-' + Date.now();
  };

  const updateUserFCMToken = async (token: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/users/fcm-token', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (!response.ok) {
        throw new Error('Failed to update FCM token');
      }
    } catch (error) {
      console.error('Failed to update FCM token:', error);
      throw error;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      return new Notification(title, options);
    }
    throw new Error('Notification permission not granted');
  };

  return {
    permission,
    fcmToken,
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window,
  };
};