import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = {
  locale: 'es',
  pathname: '/dashboard',
  asPath: '/dashboard',
  query: {},
  push: mockPush,
};

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    'languages.spanish': 'Español',
    'languages.english': 'English',
  };
  return translations[key] || key;
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
  });

  it('should render with current language', () => {
    render(<LanguageSwitcher />);
    
    const button = screen.getByRole('button', { name: /🇪🇸 Español/ });
    expect(button).toBeInTheDocument();
  });

  it('should show language options on hover', () => {
    render(<LanguageSwitcher />);
    
    // Initially, the dropdown container should be invisible
    const dropdownContainer = screen.getByRole('menu').parentElement;
    expect(dropdownContainer).toHaveClass('invisible');
    
    // Both language options should be present
    expect(screen.getByRole('menuitem', { name: /🇪🇸 Español/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /🇺🇸 English/ })).toBeInTheDocument();
  });

  it('should highlight current language in dropdown', () => {
    render(<LanguageSwitcher />);
    
    const spanishOption = screen.getByRole('menuitem', { name: /🇪🇸 Español/ });
    const englishOption = screen.getByRole('menuitem', { name: /🇺🇸 English/ });
    
    expect(spanishOption).toHaveClass('bg-gray-100', 'text-gray-900');
    expect(englishOption).toHaveClass('text-gray-700');
    
    // Check mark should be present for current language
    expect(spanishOption.querySelector('svg')).toBeInTheDocument();
    expect(englishOption.querySelector('svg')).not.toBeInTheDocument();
  });

  it('should call router.push when language is changed', () => {
    render(<LanguageSwitcher />);
    
    const englishOption = screen.getByRole('menuitem', { name: /🇺🇸 English/ });
    fireEvent.click(englishOption);
    
    expect(mockPush).toHaveBeenCalledWith(
      { pathname: '/dashboard', query: {} },
      '/dashboard',
      { locale: 'en' }
    );
  });

  it('should render with English as current language', () => {
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      locale: 'en',
    });
    
    render(<LanguageSwitcher />);
    
    const button = screen.getByRole('button', { name: /🇺🇸 English/ });
    expect(button).toBeInTheDocument();
    
    const englishOption = screen.getByRole('menuitem', { name: /🇺🇸 English/ });
    const spanishOption = screen.getByRole('menuitem', { name: /🇪🇸 Español/ });
    
    expect(englishOption).toHaveClass('bg-gray-100', 'text-gray-900');
    expect(spanishOption).toHaveClass('text-gray-700');
  });

  it('should apply custom className', () => {
    const { container } = render(<LanguageSwitcher className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should handle missing current language gracefully', () => {
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      locale: undefined,
    });
    
    render(<LanguageSwitcher />);
    
    // Should still render without crashing
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});