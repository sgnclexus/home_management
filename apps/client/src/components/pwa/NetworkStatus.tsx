import React from 'react';
import { useNetworkStatus } from '../../hooks/usePWA';
import { useTranslation } from 'next-i18next';

interface NetworkStatusProps {
  className?: string;
  showOnlineStatus?: boolean;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  className = '',
  showOnlineStatus = false,
}) => {
  const { t } = useTranslation('common');
  const { isOnline, isOffline } = useNetworkStatus();

  // Only show offline status by default, unless showOnlineStatus is true
  if (isOnline && !showOnlineStatus) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        isOffline 
          ? 'bg-red-600 text-white' 
          : 'bg-green-600 text-white'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto py-2 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {isOffline ? (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                {isOffline
                  ? t('pwa.networkStatus.offline', 'You are currently offline. Some features may be limited.')
                  : t('pwa.networkStatus.online', 'Connection restored. All features are available.')
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;