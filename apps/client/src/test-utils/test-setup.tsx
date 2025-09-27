import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../contexts/AuthContext';
import { RealtimeContext } from '../contexts/RealtimeContext';
import { useTranslation } from 'next-i18next';

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  User: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock user data
export const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'resident',
  apartmentNumber: '101',
  phoneNumber: '+1234567890',
  preferredLanguage: 'en',
  isActive: true,
};

// Mock auth context
export const mockAuthContext = {
  user: mockUser,
  loading: false,
  error: null,
  signIn: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
};

// Mock realtime context
export const mockRealtimeContext = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  optimisticUpdate: jest.fn(),
};

// Mock translation function
const mockT = (key: string, options?: any) => {
  if (options && typeof options === 'object') {
    let result = key;
    Object.keys(options).forEach(optionKey => {
      result = result.replace(`{{${optionKey}}}`, options[optionKey]);
    });
    return result;
  }
  return key;
};

// Setup translation mock
beforeEach(() => {
  (useTranslation as jest.Mock).mockReturnValue({
    t: mockT,
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  });
});

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: Partial<typeof mockAuthContext>;
  realtimeContext?: Partial<typeof mockRealtimeContext>;
  queryClient?: QueryClient;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const {
    authContext = mockAuthContext,
    realtimeContext = mockRealtimeContext,
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    ...renderOptions
  } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ ...mockAuthContext, ...authContext }}>
        <RealtimeContext.Provider value={{ ...mockRealtimeContext, ...realtimeContext }}>
          {children}
        </RealtimeContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock API responses
export const mockApiResponses = {
  payments: [
    {
      id: 'payment-1',
      userId: 'user-1',
      amount: 100,
      currency: 'USD',
      description: 'Monthly maintenance fee',
      status: 'pending',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  
  reservations: [
    {
      id: 'reservation-1',
      userId: 'user-1',
      areaId: 'area-1',
      areaName: 'Pool',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  
  meetings: [
    {
      id: 'meeting-1',
      title: 'Monthly Board Meeting',
      description: 'Regular monthly meeting',
      scheduledDate: new Date().toISOString(),
      agenda: ['Budget review', 'Maintenance updates'],
      status: 'scheduled',
      attendees: ['user-1', 'user-2'],
      createdBy: 'admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  
  notifications: [
    {
      id: 'notification-1',
      userId: 'user-1',
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      isRead: false,
      createdAt: new Date().toISOString(),
    },
  ],
};

// Mock fetch for API calls
export const mockFetch = (responses: Record<string, any>) => {
  global.fetch = jest.fn((url: string) => {
    const urlString = url.toString();
    
    // Match API endpoints to responses
    for (const [endpoint, response] of Object.entries(responses)) {
      if (urlString.includes(endpoint)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        } as Response);
      }
    }
    
    // Default response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);
  });
};

// Cleanup function
export const cleanup = () => {
  jest.clearAllMocks();
  if (global.fetch) {
    (global.fetch as jest.Mock).mockClear();
  }
};

// Test utilities for common assertions
export const testUtils = {
  expectElementToBeVisible: (element: HTMLElement) => {
    expect(element).toBeInTheDocument();
    expect(element).toBeVisible();
  },
  
  expectElementToHaveText: (element: HTMLElement, text: string) => {
    expect(element).toHaveTextContent(text);
  },
  
  expectButtonToBeEnabled: (button: HTMLElement) => {
    expect(button).toBeEnabled();
  },
  
  expectButtonToBeDisabled: (button: HTMLElement) => {
    expect(button).toBeDisabled();
  },
  
  expectFormToBeValid: (form: HTMLFormElement) => {
    expect(form).toBeValid();
  },
  
  expectFormToBeInvalid: (form: HTMLFormElement) => {
    expect(form).toBeInvalid();
  },
};