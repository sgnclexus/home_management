import React, { ReactNode } from 'react';
import { useTranslation } from 'next-i18next';

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onMenuToggle?: () => void;
  actions?: ReactNode;
  className?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showBackButton = false,
  onBack,
  onMenuToggle,
  actions,
  className = '',
}) => {
  const { t } = useTranslation('common');

  return (
    <header className={`
      fixed top-0 left-0 right-0 z-30
      bg-white border-b border-gray-200
      px-4 py-3
      flex items-center justify-between
      min-h-[4rem]
      ${className}
    `}>
      {/* Left Section */}
      <div className="flex items-center space-x-3">
        {showBackButton ? (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label={t('navigation.back', 'Go back')}
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        ) : (
          <button
            onClick={onMenuToggle}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label={t('navigation.menu', 'Open menu')}
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Center Section - Title */}
      <div className="flex-1 text-center px-4">
        {title && (
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h1>
        )}
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center space-x-2">
        {actions}
      </div>
    </header>
  );
};

export default MobileHeader;