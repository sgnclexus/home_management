import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '../../../contexts/AuthContext';
import { PasswordResetForm } from '../PasswordResetForm';

// Mock the useAuth hook
jest.mock('../../../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.resetPassword': 'Reset Password',
        'auth.resetPasswordDescription': 'Enter your email to receive password reset instructions',
        'auth.resetPasswordEmailLabel': 'Email Address',
        'auth.resetPasswordEmailPlaceholder': 'Enter your email address',
        'auth.sendResetEmail': 'Send Reset Email',
        'auth.sendingResetEmail': 'Sending...',
        'auth.resetEmailSent': 'Password reset email sent successfully',
        'auth.resetEmailSentDescription': 'If an account with that email exists, you will receive password reset instructions shortly.',
        'auth.resetEmailError': 'Failed to send reset email. Please try again.',
        'auth.emailRequired': 'Email address is required',
        'auth.emailInvalid': 'Please enter a valid email address',
        'auth.backToLogin': 'Back to Login',
      };
      return translations[key] || key;
    },
  }),
}));

describe('PasswordResetForm', () => {
  const mockResetPassword = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      resetPassword: mockResetPassword,
      user: null,
      userRole: null,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      logout: jest.fn(),
      refreshUserRole: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('renders password reset form correctly', () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getByText('Enter your email to receive password reset instructions')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Reset Email' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Login' })).toBeInTheDocument();
  });

  it('validates email field is required', async () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('clears error when user starts typing', async () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');

    // Trigger validation error
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });

    // Start typing to clear error
    fireEvent.change(emailInput, { target: { value: 'test@' } });
    expect(screen.queryByText('Email address is required')).not.toBeInTheDocument();
  });

  it('handles successful password reset', async () => {
    mockResetPassword.mockResolvedValue(undefined);

    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    // Should show success screen
    expect(screen.getByText('Password reset email sent successfully')).toBeInTheDocument();
    expect(screen.getByText('If an account with that email exists, you will receive password reset instructions shortly.')).toBeInTheDocument();
  });

  it('handles password reset error', async () => {
    const errorMessage = 'Network error';
    mockResetPassword.mockRejectedValue(new Error(errorMessage));

    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email. Please try again.')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during submission', async () => {
    mockResetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Email' });
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(form!);

    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(emailInput).toBeDisabled();
  });

  it('prevents multiple submissions during loading', async () => {
    mockResetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Email' });
    const backButton = screen.getByRole('button', { name: 'Back to Login' });
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(form!);

    // Try to submit again while loading
    fireEvent.submit(form!);
    fireEvent.click(backButton);

    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    expect(mockOnSwitchToLogin).not.toHaveBeenCalled();
  });

  it('calls onSwitchToLogin when back button is clicked', () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const backButton = screen.getByRole('button', { name: 'Back to Login' });
    fireEvent.click(backButton);

    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });

  it('calls onSwitchToLogin from success screen', async () => {
    mockResetPassword.mockResolvedValue(undefined);

    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    const form = emailInput.closest('form');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('Password reset email sent successfully')).toBeInTheDocument();
    });

    const backButtonOnSuccess = screen.getByRole('button', { name: 'Back to Login' });
    fireEvent.click(backButtonOnSuccess);

    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });

  it('has proper form attributes', () => {
    render(
      <PasswordResetForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText('Email Address');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('placeholder', 'Enter your email address');
  });

  it('accepts valid email formats', async () => {
    mockResetPassword.mockResolvedValue(undefined);

    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@test-domain.com'
    ];

    for (const email of validEmails) {
      mockResetPassword.mockClear();
      mockOnSuccess.mockClear();

      const { unmount } = render(
        <PasswordResetForm
          onSuccess={mockOnSuccess}
          onSwitchToLogin={mockOnSwitchToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const form = emailInput.closest('form');

      fireEvent.change(emailInput, { target: { value: email } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith(email);
      });

      unmount();
    }
  });

  it('rejects invalid email formats', async () => {
    const invalidEmails = [
      'invalid',
      '@example.com',
      'test@',
      'test.example.com',
      'test@.com',
      'test@example.',
      'test @example.com',
      'test@exam ple.com'
    ];

    for (const email of invalidEmails) {
      const { unmount } = render(
        <PasswordResetForm
          onSuccess={mockOnSuccess}
          onSwitchToLogin={mockOnSwitchToLogin}
        />
      );

      const emailInput = screen.getByLabelText('Email Address');
      const form = emailInput.closest('form');

      fireEvent.change(emailInput, { target: { value: email } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });

      expect(mockResetPassword).not.toHaveBeenCalled();
      unmount();
    }
  });
});