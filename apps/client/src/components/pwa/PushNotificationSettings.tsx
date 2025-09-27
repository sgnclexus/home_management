import React, { useState } from 'react';
import { usePushNotifications } from '../../hooks/usePWA';
import { useTranslation } from 'next-i18next';

interface PushNotificationSettingsProps {
  vapidPublicKey: string;
  onSubscriptionChange?: (subscription: PushSubscription | null) => void;
  className?: string;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  vapidPublicKey,
  onSubscriptionChange,
  className = '',
}) => {
  const { t } = useTranslation('common');
  const {
    permission,
    subscription,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
  } = usePushNotifications();

  const [localError, setLocalError] = useState<string | null>(null);

  if (!isSupported) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-yellow-800">
          {t('pwa.pushNotifications.notSupported', 'Push notifications are not supported in this browser.')}
        </p>
      </div>
    );
  }

  const handleEnableNotifications = async () => {
    setLocalError(null);
    try {
      const newSubscription = await subscribe(vapidPublicKey);
      onSubscriptionChange?.(newSubscription);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable notifications';
      setLocalError(errorMessage);
    }
  };

  const handleDisableNotifications = async () => {
    setLocalError(null);
    try {
      const success = await unsubscribe();
      if (success) {
        onSubscriptionChange?.(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable notifications';
      setLocalError(errorMessage);
    }
  };

  const displayError = error || localError;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">
            {t('pwa.pushNotifications.title', 'Push Notifications')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('pwa.pushNotifications.description', 
              'Get notified about important updates, payment reminders, and meeting announcements.'
            )}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0">
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">
              {subscription 
                ? t('pwa.pushNotifications.enabled', 'Enabled')
                : t('pwa.pushNotifications.disabled', 'Disabled')
              }
            </span>
            <button
              type="button"
              onClick={subscription ? handleDisableNotifications : handleEnableNotifications}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                subscription ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  subscription ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {permission === 'denied' && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">
            {t('pwa.pushNotifications.permissionDenied', 
              'Notifications are blocked. Please enable them in your browser settings.'
            )}
          </p>
        </div>
      )}

      {displayError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{displayError}</p>
        </div>
      )}

      {permission === 'default' && !subscription && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('pwa.pushNotifications.enabling', 'Enabling...')}
              </>
            ) : (
              t('pwa.pushNotifications.enable', 'Enable Notifications')
            )}
          </button>
        </div>
      )}

      {subscription && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">
                {t('pwa.pushNotifications.subscribed', 
                  'You will receive notifications for important updates and reminders.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushNotificationSettings;