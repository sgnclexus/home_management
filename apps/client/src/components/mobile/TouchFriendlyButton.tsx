import React, { ReactNode, useRef } from 'react';
import { useTouchGestures } from '../../hooks/useMobile';

interface TouchFriendlyButtonProps {
  children: ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  onSwipe?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  hapticFeedback?: boolean;
}

export const TouchFriendlyButton: React.FC<TouchFriendlyButtonProps> = ({
  children,
  onClick,
  onLongPress,
  onSwipe,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  hapticFeedback = true,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { onGesture } = useTouchGestures(buttonRef);

  // Setup gesture handlers
  React.useEffect(() => {
    const unsubscribeTap = onGesture((gesture) => {
      if (disabled) return;
      
      if (hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(10); // Light haptic feedback
      }
      
      onClick?.();
    }, 'tap');

    const unsubscribeLongPress = onGesture((gesture) => {
      if (disabled) return;
      
      if (hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate([10, 50, 10]); // Pattern for long press
      }
      
      onLongPress?.();
    }, 'longpress');

    const unsubscribeSwipe = onGesture((gesture) => {
      if (disabled || !gesture.direction) return;
      
      if (hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(15); // Medium haptic feedback
      }
      
      onSwipe?.(gesture.direction);
    }, 'swipe');

    return () => {
      unsubscribeTap();
      unsubscribeLongPress();
      unsubscribeSwipe();
    };
  }, [onGesture, onClick, onLongPress, onSwipe, disabled, hapticFeedback]);

  // Base styles
  const baseStyles = `
    relative inline-flex items-center justify-center
    font-medium rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    active:scale-95 transform
    select-none touch-manipulation
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  // Variant styles
  const variantStyles = {
    primary: `
      bg-blue-600 text-white shadow-sm
      hover:bg-blue-700 active:bg-blue-800
      focus:ring-blue-500
      ${disabled ? '' : 'shadow-lg active:shadow-md'}
    `,
    secondary: `
      bg-gray-600 text-white shadow-sm
      hover:bg-gray-700 active:bg-gray-800
      focus:ring-gray-500
      ${disabled ? '' : 'shadow-lg active:shadow-md'}
    `,
    outline: `
      bg-white text-gray-700 border-2 border-gray-300
      hover:bg-gray-50 active:bg-gray-100
      focus:ring-gray-500
    `,
    ghost: `
      bg-transparent text-gray-700
      hover:bg-gray-100 active:bg-gray-200
      focus:ring-gray-500
    `,
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-2 text-sm min-h-[2.5rem] min-w-[2.5rem]',
    md: 'px-4 py-3 text-base min-h-[3rem] min-w-[3rem]',
    lg: 'px-6 py-4 text-lg min-h-[3.5rem] min-w-[3.5rem]',
  };

  return (
    <button
      ref={buttonRef}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      // Prevent default touch behaviors
      onTouchStart={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
};

export default TouchFriendlyButton;