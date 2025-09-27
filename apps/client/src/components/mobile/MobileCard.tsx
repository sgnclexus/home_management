import React, { ReactNode, useRef } from 'react';
import { useTouchGestures } from '../../hooks/useMobile';

interface MobileCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  onClick?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  title,
  subtitle,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  className = '',
  padding = 'md',
  shadow = 'sm',
  rounded = 'lg',
  interactive = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { onGesture } = useTouchGestures(cardRef);

  // Setup gesture handlers
  React.useEffect(() => {
    if (!interactive && !onClick && !onSwipeLeft && !onSwipeRight && !onLongPress) {
      return;
    }

    const unsubscribeTap = onGesture((gesture) => {
      onClick?.();
    }, 'tap');

    const unsubscribeLongPress = onGesture((gesture) => {
      onLongPress?.();
    }, 'longpress');

    const unsubscribeSwipe = onGesture((gesture) => {
      if (gesture.direction === 'left') {
        onSwipeLeft?.();
      } else if (gesture.direction === 'right') {
        onSwipeRight?.();
      }
    }, 'swipe');

    return () => {
      unsubscribeTap();
      unsubscribeLongPress();
      unsubscribeSwipe();
    };
  }, [onGesture, onClick, onSwipeLeft, onSwipeRight, onLongPress, interactive]);

  // Style mappings
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
  };

  const roundedStyles = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
  };

  const isInteractive = interactive || onClick || onSwipeLeft || onSwipeRight || onLongPress;

  return (
    <div
      ref={cardRef}
      className={`
        bg-white border border-gray-200
        ${paddingStyles[padding]}
        ${shadowStyles[shadow]}
        ${roundedStyles[rounded]}
        ${isInteractive 
          ? 'transition-all duration-200 active:scale-[0.98] active:shadow-sm cursor-pointer touch-manipulation' 
          : ''
        }
        ${className}
      `}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

interface MobileCardActionsProps {
  children: ReactNode;
  className?: string;
}

export const MobileCardActions: React.FC<MobileCardActionsProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap gap-2 mt-4 ${className}`}>
      {children}
    </div>
  );
};

interface MobileCardGridProps {
  children: ReactNode;
  columns?: 1 | 2;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MobileCardGrid: React.FC<MobileCardGridProps> = ({
  children,
  columns = 1,
  gap = 'md',
  className = '',
}) => {
  const gapStyles = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
  };

  return (
    <div className={`
      grid ${columnStyles[columns]} ${gapStyles[gap]}
      ${className}
    `}>
      {children}
    </div>
  );
};

