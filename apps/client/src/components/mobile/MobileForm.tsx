import React, { ReactNode, useRef, useEffect } from 'react';
import { useMobileForm, useViewport } from '../../hooks/useMobile';

interface MobileFormProps {
  children: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  className?: string;
  autoAdjustForKeyboard?: boolean;
}

export const MobileForm: React.FC<MobileFormProps> = ({
  children,
  onSubmit,
  className = '',
  autoAdjustForKeyboard = true,
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { isKeyboardOpen, focusedField, shouldAdjustLayout } = useMobileForm();
  const { height } = useViewport();

  // Auto-scroll to focused field when keyboard opens
  useEffect(() => {
    if (autoAdjustForKeyboard && focusedField && isKeyboardOpen) {
      const focusedElement = document.querySelector(`[name="${focusedField}"]`) as HTMLElement;
      if (focusedElement) {
        setTimeout(() => {
          focusedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }, 300); // Wait for keyboard animation
      }
    }
  }, [focusedField, isKeyboardOpen, autoAdjustForKeyboard]);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={`
        ${className}
        ${shouldAdjustLayout ? 'pb-4' : ''}
      `}
      style={{
        minHeight: autoAdjustForKeyboard && isKeyboardOpen 
          ? `${height * 0.6}px` 
          : 'auto',
      }}
    >
      {children}
    </form>
  );
};

interface MobileFormFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

export const MobileFormField: React.FC<MobileFormFieldProps> = ({
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  required = false,
  disabled = false,
  error,
  multiline = false,
  rows = 3,
  className = '',
}) => {
  const { onFieldFocus, onFieldBlur } = useMobileForm();

  const handleFocus = (e: React.FocusEvent) => {
    onFieldFocus(name);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent) => {
    onFieldBlur();
    onBlur?.(e);
  };

  const inputClasses = `
    w-full px-4 py-3 text-base
    border-2 rounded-lg
    transition-colors duration-200
    focus:outline-none focus:ring-0
    ${error 
      ? 'border-red-300 focus:border-red-500' 
      : 'border-gray-300 focus:border-blue-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    touch-manipulation
    min-h-[3rem]
  `;

  return (
    <div className={`space-y-2 ${className}`}>
      <label 
        htmlFor={name}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className={`${inputClasses} resize-none`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          className={inputClasses}
        />
      )}
      
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
};

