import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '../../../contexts/AuthContext';
import { UserProfile } from '../UserProfile';
import { UserRole } from '@home-management/types';

// Mock the useAuth hook
jest.mock('../../../contexts/AuthContext');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'profile.title': 'User Profile',
        'profile.role': 'Role',
        'profile.displayName': 'Full Name',
        'profile.apartmentNumber': 'Apartment Number',
        'profile.phoneNumber': 'Phone Number',
        'profile.preferredLanguage': 'Preferred Language',
        'profile.email': 'Email',
        'profile.uid': 'User ID',
        'profile.apartmentPlaceholder': 'e.g., 101, A-205',
        'profile.phonePlaceholder': 'e.g., +1234567890',
        'profile.save': 'Save Changes',
        'profile.saving': 'Saving...',
        'profile.updateSuccess': 'Profile updated successfully',
        'profile.updateError': 'Failed to update profile',
        'profile.loadError': 'Failed to load profile',
        'roles.resident': 'Resident',
        'languages.spanish': 'Spanish',
        'languages.english': 'English',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('UserProfile', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    getIdToken: jest.fn().mockResolvedValue('mock-token'),
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser as any,
      userRole: UserRole.RESIDENT,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      logout: jest.fn(),
      resetPassword: jest.fn(),
      refreshUserRole: jest.fn(),
    });

    jest.clearAllMocks();
  });

  it('renders user profile form correctly', async () => {
    const mockProfileData = {
      displayName: 'Test User',
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText('User Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('101')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1234567890')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<UserProfile />);

    expect(screen.getByTestId('loading-skeleton') || screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles profile update successfully', async () => {
    const mockProfileData = {
      displayName: 'Test User',
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    // Mock initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);

    // Mock update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const displayNameInput = screen.getByDisplayValue('Test User');
    fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/me`,
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...mockProfileData,
          displayName: 'Updated Name',
        }),
      })
    );
  });

  it('handles profile update error', async () => {
    const mockProfileData = {
      displayName: 'Test User',
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    // Mock initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);

    // Mock update error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Update failed' }),
    } as Response);

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('displays user information correctly', async () => {
    const mockProfileData = {
      displayName: 'Test User',
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('test-uid')).toBeInTheDocument();
      expect(screen.getByText('Resident')).toBeInTheDocument();
    });
  });

  it('handles form field changes', async () => {
    const mockProfileData = {
      displayName: 'Test User',
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfileData),
    } as Response);

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });

    const apartmentInput = screen.getByDisplayValue('101');
    fireEvent.change(apartmentInput, { target: { value: '202' } });

    expect(screen.getByDisplayValue('202')).toBeInTheDocument();
  });
});