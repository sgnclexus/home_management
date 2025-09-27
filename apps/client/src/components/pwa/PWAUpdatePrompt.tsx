import React from 'react';
import { usePWAUpdate } from '../../hooks/usePWA';
import { useTranslation } from 'next-i18next';

interface PWAUpdatePromptProps {
  className?: string;
  onUpdate?: () => void;
}

export const PWAUpdatePrompt: React.FC<PWAUpdatePromptProps> = ({
  className = '',
  onUpdate,
}) => {
  const { t } = useTranslation('common');
  const { updateAvailable, isUpdating, applyUpdate } = usePWAUpdate();

  if (!updateAvailable) {
    return null;
  }

  const handleUpdate = async () => {
    try {
      await applyUpdate();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to apply update:', error);
    }
  };

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-green-400"
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
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-green-800">
            {t('pwa.updatePrompt.title', 'App Update Available')}
          </h3>
          <div className="mt-2 text-sm text-green-700">
            <p>
              {t('pwa.updatePrompt.description', 
                'A new version of the app is available with improvements and bug fixes.'
              )}
            </p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating 
                ? t('pwa.updatePrompt.updating', 'Updating...') 
                : t('pwa.updatePrompt.update', 'Update Now')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;