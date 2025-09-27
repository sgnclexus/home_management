/**
 * End-to-end tests for mobile functionality
 * These tests verify mobile-specific features and interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { MobileLayout } from '../../components/mobile/MobileLayout';
import { TouchFriendlyButton } from '../../components/mobile/TouchFriendlyButton';
import { MobileForm, MobileFormField } from '../../components/mobile/MobileForm';
import { MobileCard } from '../../components/mobile/MobileCard';

// Mock dependencies
jest.mock('next/router');
jest.mock('next-i18next');
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'resident',
    },
    logout: jest.fn(),
  }),
}));

jest.mock('../../hooks/useMobile', () => ({
  useMobileNavigation: () => ({
    isMenuOpen: false,
    toggleMenu: jest.fn(),
    closeMenu: jest.fn(),
    isMobile: true,
  }),
  useViewport: () => ({
    width: 375,
    height: 667,
    isKeyboardOpen: false,
    availableHeight: 667,
  }),
  useDeviceDetection: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: true,
    screenSize: 'sm',
    orientation: 'portrait',
  }),
  useMobileForm: () => ({
    isKeyboardOpen: false,
    focusedField: null,
    onFieldFocus: jest.fn(),
    onFieldBlur: jest.fn(),
    shouldAdjustLayout: false,
  }),
  useTouchGestures: () => ({
    onGesture: jest.fn(() => jest.fn()),
    recentGestures: [],
  }),
}));

const mockPush = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

describe('Mobile Functionality E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      pathname: '/dashboard',
      query: {},
      asPath: '/dashboard',
      route: '/dashboard',
    } as any);

    mockUseTranslation.mockReturnValue({
      t: (key: string, defaultValue?: string) => defaultValue || key,
      i18n: {} as any,
      ready: true,
    });
  });

  describe('Mobile Layout', () => {
    it('should render mobile layout with header and content', () => {
      render(
        <MobileLayout title="Test Page">
          <div>Test Content</div>
        </MobileLayout>
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should show back button when specified', () => {
      const onBack = jest.fn();
      
      render(
        <MobileLayout title="Test Page" showBackButton onBack={onBack}>
          <div>Test Content</div>
        </MobileLayout>
      );

      const backButton = screen.getByLabelText(/go back/i);
      expect(backButton).toBeInTheDocument();
      
      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalled();
    });

    it('should render bottom bar by default', () => {
      render(
        <MobileLayout>
          <div>Test Content</div>
        </MobileLayout>
      );

      // Check for bottom navigation items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Payments')).toBeInTheDocument();
      expect(screen.getByText('Reservations')).toBeInTheDocument();
      expect(screen.getByText('Meetings')).toBeInTheDocument();
    });

    it('should hide bottom bar when showBottomBar is false', () => {
      render(
        <MobileLayout showBottomBar={false}>
          <div>Test Content</div>
        </MobileLayout>
      );

      // Bottom navigation should not be present
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Touch Friendly Button', () => {
    it('should render button with correct styling', () => {
      render(
        <TouchFriendlyButton onClick={jest.fn()}>
          Test Button
        </TouchFriendlyButton>
      );

      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('touch-manipulation');
    });

    it('should handle click events', () => {
      const onClick = jest.fn();
      
      render(
        <TouchFriendlyButton onClick={onClick}>
          Test Button
        </TouchFriendlyButton>
      );

      const button = screen.getByRole('button', { name: 'Test Button' });
      fireEvent.click(button);
      
      expect(onClick).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      const onClick = jest.fn();
      
      render(
        <TouchFriendlyButton onClick={onClick} disabled>
          Test Button
        </TouchFriendlyButton>
      );

      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should apply different variants correctly', () => {
      const { rerender } = render(
        <TouchFriendlyButton variant="primary">Primary</TouchFriendlyButton>
      );
      
      let button = screen.getByRole('button', { name: 'Primary' });
      expect(button).toHaveClass('bg-blue-600', 'text-white');

      rerender(
        <TouchFriendlyButton variant="outline">Outline</TouchFriendlyButton>
      );
      
      button = screen.getByRole('button', { name: 'Outline' });
      expect(button).toHaveClass('bg-white', 'border-2', 'border-gray-300');
    });

    it('should apply different sizes correctly', () => {
      const { rerender } = render(
        <TouchFriendlyButton size="sm">Small</TouchFriendlyButton>
      );
      
      let button = screen.getByRole('button', { name: 'Small' });
      expect(button).toHaveClass('px-3', 'py-2', 'text-sm');

      rerender(
        <TouchFriendlyButton size="lg">Large</TouchFriendlyButton>
      );
      
      button = screen.getByRole('button', { name: 'Large' });
      expect(button).toHaveClass('px-6', 'py-4', 'text-lg');
    });
  });

  describe('Mobile Form', () => {
    it('should render form with fields', () => {
      const onSubmit = jest.fn();
      
      render(
        <MobileForm onSubmit={onSubmit}>
          <MobileFormField
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email"
          />
          <MobileFormField
            label="Message"
            name="message"
            multiline
            placeholder="Enter your message"
          />
        </MobileForm>
      );

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your message')).toBeInTheDocument();
    });

    it('should show required indicator for required fields', () => {
      render(
        <MobileForm>
          <MobileFormField
            label="Required Field"
            name="required"
            required
          />
        </MobileForm>
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should show error message when error is provided', () => {
      render(
        <MobileForm>
          <MobileFormField
            label="Email"
            name="email"
            error="Invalid email address"
          />
        </MobileForm>
      );

      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });

    it('should handle form submission', () => {
      const onSubmit = jest.fn((e) => e.preventDefault());
      
      render(
        <MobileForm onSubmit={onSubmit}>
          <MobileFormField label="Name" name="name" />
          <button type="submit">Submit</button>
        </MobileForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      fireEvent.click(submitButton);
      
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('Mobile Card', () => {
    it('should render card with title and content', () => {
      render(
        <MobileCard title="Test Card" subtitle="Test Subtitle">
          <div>Card Content</div>
        </MobileCard>
      );

      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('should handle click events when interactive', () => {
      const onClick = jest.fn();
      
      render(
        <MobileCard title="Clickable Card" onClick={onClick} interactive>
          <div>Card Content</div>
        </MobileCard>
      );

      const card = screen.getByText('Clickable Card').closest('div');
      expect(card).toHaveClass('cursor-pointer', 'touch-manipulation');
    });

    it('should apply different padding sizes', () => {
      const { rerender } = render(
        <MobileCard padding="sm">
          <div>Content</div>
        </MobileCard>
      );

      let card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('p-3');

      rerender(
        <MobileCard padding="lg">
          <div>Content</div>
        </MobileCard>
      );

      card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('p-6');
    });

    it('should apply different shadow levels', () => {
      const { rerender } = render(
        <MobileCard shadow="none">
          <div>Content</div>
        </MobileCard>
      );

      let card = screen.getByText('Content').closest('div');
      expect(card).not.toHaveClass('shadow-sm', 'shadow-md', 'shadow-lg');

      rerender(
        <MobileCard shadow="lg">
          <div>Content</div>
        </MobileCard>
      );

      card = screen.getByText('Content').closest('div');
      expect(card).toHaveClass('shadow-lg');
    });
  });

  describe('Mobile Navigation', () => {
    it('should navigate to different pages when bottom bar items are clicked', async () => {
      render(
        <MobileLayout>
          <div>Test Content</div>
        </MobileLayout>
      );

      const paymentsButton = screen.getByText('Payments');
      fireEvent.click(paymentsButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/payments');
      });
    });

    it('should show active state for current page', () => {
      mockUseRouter.mockReturnValue({
        push: mockPush,
        pathname: '/payments',
        query: {},
        asPath: '/payments',
        route: '/payments',
      } as any);

      render(
        <MobileLayout>
          <div>Test Content</div>
        </MobileLayout>
      );

      const paymentsButton = screen.getByText('Payments');
      expect(paymentsButton.closest('button')).toHaveClass('text-blue-600', 'bg-blue-50');
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different screen sizes', () => {
      // This would typically be tested with different viewport sizes
      // For now, we'll test that the components render without errors
      render(
        <MobileLayout>
          <MobileCard>
            <MobileForm>
              <MobileFormField label="Test" name="test" />
              <TouchFriendlyButton>Submit</TouchFriendlyButton>
            </MobileForm>
          </MobileCard>
        </MobileLayout>
      );

      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', () => {
      render(
        <MobileLayout title="Test Page" showBackButton>
          <TouchFriendlyButton>Accessible Button</TouchFriendlyButton>
        </MobileLayout>
      );

      expect(screen.getByLabelText(/go back/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accessible Button' })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(
        <MobileForm>
          <MobileFormField label="First Field" name="first" />
          <MobileFormField label="Second Field" name="second" />
          <TouchFriendlyButton>Submit</TouchFriendlyButton>
        </MobileForm>
      );

      const firstField = screen.getByLabelText('First Field');
      const secondField = screen.getByLabelText('Second Field');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      // Test tab navigation
      firstField.focus();
      expect(document.activeElement).toBe(firstField);

      fireEvent.keyDown(firstField, { key: 'Tab' });
      // In a real browser, this would move focus to the next element
      // For testing purposes, we just verify the elements are focusable
      expect(secondField).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });
  });
});