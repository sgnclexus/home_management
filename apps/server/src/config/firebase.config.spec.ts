import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseConfigService } from './firebase.config';

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn().mockReturnValue({
    options: { projectId: 'test-project' },
  }),
  auth: jest.fn().mockReturnValue({}),
  firestore: jest.fn().mockReturnValue({}),
  messaging: jest.fn().mockReturnValue({}),
  credential: {
    cert: jest.fn().mockReturnValue({}),
  },
}));

describe('FirebaseConfigService', () => {
  let service: FirebaseConfigService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        FIREBASE_PROJECT_ID: 'test-project',
        FIREBASE_CLIENT_EMAIL: 'test@test-project.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
        FIREBASE_DATABASE_URL: 'https://test-project-default-rtdb.firebaseio.com',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    // Set environment variables for the utility function
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n';
    process.env.FIREBASE_DATABASE_URL = 'https://test-project-default-rtdb.firebaseio.com';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FirebaseConfigService>(FirebaseConfigService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_DATABASE_URL;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize Firebase Admin SDK', () => {
    expect(service.getApp()).toBeDefined();
  });

  it('should provide Firebase Auth service', () => {
    expect(service.getAuth()).toBeDefined();
  });

  it('should provide Firebase Firestore service', () => {
    expect(service.getFirestore()).toBeDefined();
  });

  // Note: Firebase Functions service is not included in this basic configuration

  it('should provide Firebase Messaging service', () => {
    expect(service.getMessaging()).toBeDefined();
  });

  it('should return project ID', () => {
    expect(service.getProjectId()).toBe('test-project');
  });
});