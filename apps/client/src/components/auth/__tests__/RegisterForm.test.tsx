import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '../../../contexts/AuthContext';
import { RegisterForm } from '../RegisterForm';
import { UserRole } from '@home-management/types';

// Mock the useAuth hook
jest.mock('../../../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.register': 'Register',
        'auth.displayName': 'Full Name',
        'auth.email': 'Email',
        'auth.role': 'Role',
        'auth.roleDescription': 'Select your role in the condominium',
        'auth.password': 'Password',
        'auth.confirmPassword': 'Confirm Password',
        'auth.passwordRequirements': 'At least 8 characters required',
        'auth.displayNamePlaceholder': 'Enter your full name',
        'auth.emailPlaceholder': 'Enter your email',
        'auth.passwordPlaceholder': 'Enter your password',
        'auth.confirmPasswordPlaceholder': 'Confirm your password',
        'auth.registering': 'Creating account...',
        'auth.hasAccount': 'Already have an account?',
        'auth.login': 'Login',
        'auth.passwordMismatch': 'Passwords do not match',
        'auth.passwordTooShort': 'Password must be at least 8 characters long',
        'auth.registerError': 'Registration failed',
        'roles.resident': 'Resident',
        'roles.vigilance': 'Vigilance Committee',
        'roles.security': 'Security',
        'roles.admin': 'Administrator',
        'profile.apartmentNumber': 'Apartment Number',
        'profile.phoneNumber': 'Phone Number',
        'profile.apartmentPlaceholder': 'e.g., 101, A-205',
        'profile.phonePlaceholder': 'e.g., +1234567890',
      };
      return translations[key] || key;
    },
  }),
}));

describe('RegisterForm', () => {
  const mockSignUp = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      signUp: mockSignUp,
      user: null,
      userRole: null,
      loading: false,
      signIn: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      refreshUserRole: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('renders registration form with role selection', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByLabelText('Apartment Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('has all role options available', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const roleSelect = screen.getByLabelText('Role');
    expect(roleSelect).toBeInTheDocument();
    
    // Check that all role options are present
    expect(screen.getByRole('option', { name: 'Resident' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Vigilance Committee' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
  });

  it('defaults to resident role', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    expect(roleSelect.value).toBe(UserRole.RESIDENT);
  });

  it('handles successful registration with role and additional data', async () => {
    mockSignUp.mockResolvedValue(undefined);

    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText('Full Name'), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'john@example.com' } 
    });
    fireEvent.change(screen.getByLabelText('Role'), { 
      target: { value: UserRole.VIGILANCE } 
    });
    fireEvent.change(screen.getByLabelText('Apartment Number'), { 
      target: { value: '101' } 
    });
    fireEvent.change(screen.getByLabelText('Phone Number'), { 
      target: { value: '+1234567890' } 
    });
    fireEvent.change(screen.getByLabelText('Password'), { 
      target: { value: 'password123' } 
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { 
      target: { value: 'password123' } 
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        'john@example.com',
        'password123',
        'John Doe',
        {
          role: UserRole.VIGILANCE,
          apartmentNumber: '101',
          phoneNumber: '+1234567890',
        }
      );
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('validates password mismatch', async () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    fireEvent.change(screen.getByLabelText('Full Name'), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'john@example.com' } 
    });
    fireEvent.change(screen.getByLabelText('Password'), { 
      target: { value: 'password123' } 
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { 
      target: { value: 'differentpassword' } 
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('validates password length', async () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    fireEvent.change(screen.getByLabelText('Full Name'), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'john@example.com' } 
    });
    fireEvent.change(screen.getByLabelText('Password'), { 
      target: { value: 'short' } 
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { 
      target: { value: 'short' } 
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
    });

    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('handles registration error', async () => {
    const errorMessage = 'Email already exists';
    mockSignUp.mockRejectedValue(new Error(errorMessage));

    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    // Fill out valid form
    fireEvent.change(screen.getByLabelText('Full Name'), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'john@example.com' } 
    });
    fireEvent.change(screen.getByLabelText('Password'), { 
      target: { value: 'password123' } 
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { 
      target: { value: 'password123' } 
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('shows loading state during registration', async () => {
    mockSignUp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    // Fill out valid form
    fireEvent.change(screen.getByLabelText('Full Name'), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText('Email'), { 
      target: { value: 'john@example.com' } 
    });
    fireEvent.change(screen.getByLabelText('Password'), { 
      target: { value: 'password123' } 
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { 
      target: { value: 'password123' } 
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByText('Creating account...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
  });

  it('calls onSwitchToLogin when login link is clicked', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    fireEvent.click(screen.getByText('Login'));
    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });

  it('allows changing role selection', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    
    // Change to admin role
    fireEvent.change(roleSelect, { target: { value: UserRole.ADMIN } });
    expect(roleSelect.value).toBe(UserRole.ADMIN);

    // Change to security role
    fireEvent.change(roleSelect, { target: { value: UserRole.SECURITY } });
    expect(roleSelect.value).toBe(UserRole.SECURITY);
  });

  it('has proper form field attributes', () => {
    render(
      <RegisterForm
        onSuccess={mockOnSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    expect(screen.getByLabelText('Full Name')).toHaveAttribute('required');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('required');
    expect(screen.getByLabelText('Role')).toHaveAttribute('required');
    expect(screen.getByLabelText('Phone Number')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('required');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('required');
  });
});