import { initializeFirebase, auth, firestore, functions } from './firebase.config';

// Mock Firebase SDK
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn().mockReturnValue({
    name: 'test-app',
    options: {
      projectId: 'test-project',
    },
  }),
  getApps: jest.fn().mockReturnValue([]),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn().mockReturnValue({ currentUser: null }),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({ app: 'firestore-instance' }),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn().mockReturnValue({ app: 'functions-instance' }),
}));

jest.mock('firebase/messaging', () => ({
  getMessaging: jest.fn().mockReturnValue({ app: 'messaging-instance' }),
  isSupported: jest.fn().mockResolvedValue(true),
}));

describe('Firebase Client Configuration', () => {
  beforeEach(() => {
    // Set environment variables
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:abcdef';
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = 'G-ABCDEF123';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  });

  it('should initialize Firebase app successfully', () => {
    const app = initializeFirebase();
    expect(app).toBeDefined();
    expect(app.name).toBe('test-app');
  });

  it('should provide Firebase Auth service', () => {
    const authService = auth();
    expect(authService).toBeDefined();
    expect(authService.currentUser).toBeNull();
  });

  it('should provide Firebase Firestore service', () => {
    const firestoreService = firestore();
    expect(firestoreService).toBeDefined();
    expect(firestoreService.app).toBe('firestore-instance');
  });

  it('should provide Firebase Functions service', () => {
    const functionsService = functions();
    expect(functionsService).toBeDefined();
    expect(functionsService.app).toBe('functions-instance');
  });

  it('should throw error when required environment variables are missing', () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    
    expect(() => {
      initializeFirebase();
    }).toThrow('Missing required Firebase configuration');
  });
});