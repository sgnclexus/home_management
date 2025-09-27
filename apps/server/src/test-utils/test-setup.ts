import { Test, TestingModule } from '@nestjs/testing';
import { FirebaseConfigService } from '../config/firebase.config';

// Mock Firestore
export const createMockFirestore = () => ({
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  set: jest.fn(),
  get: jest.fn(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  update: jest.fn(),
  delete: jest.fn(),
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  })),
  add: jest.fn(),
});

// Mock Firebase Config Service
export const createMockFirebaseConfigService = (mockFirestore: any) => ({
  getFirestore: () => mockFirestore,
  getAuth: () => ({}),
  getMessaging: () => ({}),
});

// Mock Firebase Admin
export const createMockFirebaseAdmin = () => ({
  auth: () => ({
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  }),
  firestore: createMockFirestore,
  messaging: () => ({
    send: jest.fn(),
    sendMulticast: jest.fn(),
  }),
});

// Common test module setup
export const createTestModule = async (providers: any[]) => {
  const mockFirestore = createMockFirestore();
  const mockFirebaseConfig = createMockFirebaseConfigService(mockFirestore);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ...providers,
      {
        provide: FirebaseConfigService,
        useValue: mockFirebaseConfig,
      },
    ],
  }).compile();

  return { module, mockFirestore, mockFirebaseConfig };
};

// Mock document data
export const createMockDocument = (data: any, exists = true) => ({
  exists,
  data: () => data,
  id: data?.id || 'mock-id',
  ref: {
    id: data?.id || 'mock-id',
  },
});

// Mock query snapshot
export const createMockQuerySnapshot = (docs: any[]) => ({
  docs: docs.map(doc => createMockDocument(doc)),
  forEach: (callback: (doc: any) => void) => {
    docs.forEach(doc => callback(createMockDocument(doc)));
  },
  size: docs.length,
  empty: docs.length === 0,
});

// Mock user data
export const createMockUser = (overrides: any = {}) => ({
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'resident',
  apartmentNumber: '101',
  phoneNumber: '+1234567890',
  preferredLanguage: 'en',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock payment data
export const createMockPayment = (overrides: any = {}) => ({
  id: 'payment-1',
  userId: 'user-1',
  amount: 100,
  currency: 'USD',
  description: 'Monthly maintenance fee',
  status: 'pending',
  dueDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock meeting data
export const createMockMeeting = (overrides: any = {}) => ({
  id: 'meeting-1',
  title: 'Monthly Board Meeting',
  description: 'Regular monthly meeting',
  scheduledDate: new Date(),
  agenda: ['Budget review', 'Maintenance updates'],
  status: 'scheduled',
  attendees: ['user-1', 'user-2'],
  createdBy: 'admin-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock reservation data
export const createMockReservation = (overrides: any = {}) => ({
  id: 'reservation-1',
  userId: 'user-1',
  areaId: 'area-1',
  areaName: 'Pool',
  startTime: new Date(),
  endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
  status: 'confirmed',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock notification data
export const createMockNotification = (overrides: any = {}) => ({
  id: 'notification-1',
  userId: 'user-1',
  title: 'Test Notification',
  message: 'This is a test notification',
  type: 'info',
  isRead: false,
  createdAt: new Date(),
  ...overrides,
});