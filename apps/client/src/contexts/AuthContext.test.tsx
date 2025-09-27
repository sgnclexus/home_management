import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { UserRole } from '@home-management/types';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

// Mock Firebase config
jest.mock('../config/firebase.config', () => ({
  auth: jest.fn().mockReturnValue({}),
}));

// Mock fetch
global.fetch = jest.fn();

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const { user, userRole, loading, signIn, signUp, logout, resetPassword } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? user.email : 'No User'}</div>
      <div data-testid="role">{userRole || 'No Role'}</div>
      <button onClick={() => signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => signUp('test@example.com', 'password', 'Test User')}>Sign Up</button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => resetPassword('test@example.com')}>Reset Password</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ role: UserRole.RESIDENT }),
    });
  });

  it('should provide auth context values', () => {
    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // No user initially
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('role')).toHaveTextContent('No Role');
  });

  it('should handle user authentication state changes', async () => {
    const mockUser = {
      email: 'test@example.com',
      uid: 'test-uid',
      getIdToken: jest.fn().mockResolvedValue('mock-token'),
    };

    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      setTimeout(() => callback(mockUser), 0); // Simulate async auth state change
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    await waitFor(() => {
      expect(screen.getByTestId('role')).toHaveTextContent(UserRole.RESIDENT);
    });
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('should handle sign in', async () => {
    const mockSignInWithEmailAndPassword = require('firebase/auth').signInWithEmailAndPassword;
    const mockUser = {
      email: 'test@example.com',
      uid: 'test-uid',
      getIdToken: jest.fn().mockResolvedValue('mock-token'),
    };

    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // No user initially
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const signInButton = screen.getByText('Sign In');
    signInButton.click();

    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password'
      );
    });
  });

  it('should handle sign up', async () => {
    const mockCreateUserWithEmailAndPassword = require('firebase/auth').createUserWithEmailAndPassword;
    const mockUpdateProfile = require('firebase/auth').updateProfile;
    const mockUser = {
      email: 'test@example.com',
      uid: 'test-uid',
      getIdToken: jest.fn().mockResolvedValue('mock-token'),
    };

    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockUpdateProfile.mockResolvedValue(undefined);

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ role: UserRole.RESIDENT }),
    });

    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // No user initially
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const signUpButton = screen.getByText('Sign Up');
    signUpButton.click();

    await waitFor(() => {
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password'
      );
    });

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'Test User',
      });
    });
  });

  it('should handle logout', async () => {
    const mockSignOut = require('firebase/auth').signOut;
    mockSignOut.mockResolvedValue(undefined);

    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // No user initially
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it('should handle password reset', async () => {
    const mockSendPasswordResetEmail = require('firebase/auth').sendPasswordResetEmail;
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null); // No user initially
      return jest.fn(); // Unsubscribe function
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const resetButton = screen.getByText('Reset Password');
    resetButton.click();

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com'
      );
    });
  });
});