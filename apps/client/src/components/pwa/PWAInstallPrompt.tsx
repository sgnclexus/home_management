import React from 'react';
import { usePWAInstall } from '../../hooks/usePWA';
import { useTranslation } from 'next-i18next';

interface PWAInstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  className = '',
  onInstall,
  onDismiss,
}) => {
  const { t } = useTranslation('common');
  const { isInstallable, isInstalled, showInstallPrompt, dismissInstallPrompt } = usePWAInstall();

  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await showInstallPrompt();
      onInstall?.();
    } catch (error) {
      console.error('Failed to show install prompt:', error);
    }
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    onDismiss?.();
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            {t('pwa.installPrompt.title', 'Install Home Management App')}
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              {t('pwa.installPrompt.description', 
                'Install our app for a better experience with offline access and push notifications.'
              )}
            </p>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              type="button"
              onClick={handleInstall}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('pwa.installPrompt.install', 'Install')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="bg-white text-blue-600 px-3 py-2 rounded-md text-sm font-medium border border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('pwa.installPrompt.dismiss', 'Not now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;