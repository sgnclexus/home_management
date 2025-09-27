import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { UserProfile } from '../../components/auth/UserProfile';
import { useAuth } from '../../contexts/AuthContext';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = {
  locale: 'es',
  pathname: '/profile',
  asPath: '/profile',
  query: {},
  push: mockPush,
};

const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
};

const mockAuth = {
  user: mockUser,
  userRole: 'resident',
};

// Mock fetch
global.fetch = jest.fn();

describe('Language Switching Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue(mockAuth);
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        displayName: 'Test User',
        apartmentNumber: '101',
        phoneNumber: '+1234567890',
        preferredLanguage: 'es',
      }),
    });
  });

  describe('Spanish Language', () => {
    beforeEach(() => {
      (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => {
          const spanishTranslations: Record<string, string> = {
            'languages.spanish': 'Español',
            'languages.english': 'Inglés',
            'profile.title': 'Perfil de Usuario',
            'profile.displayName': 'Nombre Completo',
            'profile.apartmentNumber': 'Número de Apartamento',
            'profile.phoneNumber': 'Número de Teléfono',
            'profile.preferredLanguage': 'Idioma Preferido',
            'profile.save': 'Guardar',
            'profile.email': 'Correo electrónico',
            'profile.uid': 'ID de Usuario',
            'roles.resident': 'Residente',
          };
          return spanishTranslations[key] || key;
        },
      });
    });

    it('should display Spanish content in UserProfile', async () => {
      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Perfil de Usuario')).toBeInTheDocument();
        expect(screen.getByText('Nombre Completo')).toBeInTheDocument();
        expect(screen.getByText('Número de Apartamento')).toBeInTheDocument();
        expect(screen.getByText('Número de Teléfono')).toBeInTheDocument();
        expect(screen.getByText('Idioma Preferido')).toBeInTheDocument();
        expect(screen.getByText('Guardar')).toBeInTheDocument();
      });
    });

    it('should show Spanish as current language in LanguageSwitcher', () => {
      render(<LanguageSwitcher />);
      
      const button = screen.getByRole('button', { name: /🇪🇸 Español/ });
      expect(button).toBeInTheDocument();
    });
  });

  describe('English Language', () => {
    beforeEach(() => {
      (useRouter as jest.Mock).mockReturnValue({
        ...mockRouter,
        locale: 'en',
      });

      (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => {
          const englishTranslations: Record<string, string> = {
            'languages.spanish': 'Spanish',
            'languages.english': 'English',
            'profile.title': 'User Profile',
            'profile.displayName': 'Full Name',
            'profile.apartmentNumber': 'Apartment Number',
            'profile.phoneNumber': 'Phone Number',
            'profile.preferredLanguage': 'Preferred Language',
            'profile.save': 'Save',
            'profile.email': 'Email',
            'profile.uid': 'User ID',
            'roles.resident': 'Resident',
          };
          return englishTranslations[key] || key;
        },
      });
    });

    it('should display English content in UserProfile', async () => {
      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('User Profile')).toBeInTheDocument();
        expect(screen.getByText('Full Name')).toBeInTheDocument();
        expect(screen.getByText('Apartment Number')).toBeInTheDocument();
        expect(screen.getByText('Phone Number')).toBeInTheDocument();
        expect(screen.getByText('Preferred Language')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('should show English as current language in LanguageSwitcher', () => {
      render(<LanguageSwitcher />);
      
      const button = screen.getByRole('button', { name: /🇺🇸 English/ });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Language Switching Behavior', () => {
    beforeEach(() => {
      (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => {
          const translations: Record<string, string> = {
            'languages.spanish': 'Español',
            'languages.english': 'English',
          };
          return translations[key] || key;
        },
      });
    });

    it('should call router.push when switching from Spanish to English', () => {
      render(<LanguageSwitcher />);
      
      const englishOption = screen.getByRole('menuitem', { name: /🇺🇸 English/ });
      fireEvent.click(englishOption);
      
      expect(mockPush).toHaveBeenCalledWith(
        { pathname: '/profile', query: {} },
        '/profile',
        { locale: 'en' }
      );
    });

    it('should call router.push when switching from English to Spanish', () => {
      (useRouter as jest.Mock).mockReturnValue({
        ...mockRouter,
        locale: 'en',
      });

      render(<LanguageSwitcher />);
      
      const spanishOption = screen.getByRole('menuitem', { name: /🇪🇸 Español/ });
      fireEvent.click(spanishOption);
      
      expect(mockPush).toHaveBeenCalledWith(
        { pathname: '/profile', query: {} },
        '/profile',
        { locale: 'es' }
      );
    });

    it('should update user preference when language is changed in profile', async () => {
      const mockPut = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (options?.method === 'PUT') {
          return mockPut(url, options);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            displayName: 'Test User',
            apartmentNumber: '101',
            phoneNumber: '+1234567890',
            preferredLanguage: 'es',
          }),
        });
      });

      (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => {
          const translations: Record<string, string> = {
            'profile.title': 'User Profile',
            'profile.displayName': 'Full Name',
            'profile.apartmentNumber': 'Apartment Number',
            'profile.phoneNumber': 'Phone Number',
            'profile.preferredLanguage': 'Preferred Language',
            'profile.save': 'Save',
            'profile.email': 'Email',
            'profile.uid': 'User ID',
            'languages.spanish': 'Spanish',
            'languages.english': 'English',
            'roles.resident': 'Resident',
          };
          return translations[key] || key;
        },
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /Preferred Language/i })).toBeInTheDocument();
      });

      // Change language preference to English
      const languageSelect = screen.getByRole('combobox', { name: /Preferred Language/i });
      fireEvent.change(languageSelect, { target: { value: 'en' } });

      // Submit the form
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          expect.stringContaining('/users/me'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"preferredLanguage":"en"'),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (useTranslation as jest.Mock).mockReturnValue({
        t: (key: string) => {
          const translations: Record<string, string> = {
            'profile.title': 'User Profile',
            'profile.loadError': 'Failed to load profile',
            'profile.updateError': 'Failed to update profile',
            'profile.save': 'Save',
            'save': 'Save',
            'languages.spanish': 'Spanish',
            'languages.english': 'English',
          };
          return translations[key] || key;
        },
      });
    });

    it('should display error message in current language when profile load fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
      });
    });

    it('should display error message in current language when profile update fails', async () => {
      // Mock successful load, failed update
      (global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (options?.method === 'PUT') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'Update failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            displayName: 'Test User',
            apartmentNumber: '101',
            phoneNumber: '+1234567890',
            preferredLanguage: 'es',
          }),
        });
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Update failed')).toBeInTheDocument();
      });
    });
  });
});