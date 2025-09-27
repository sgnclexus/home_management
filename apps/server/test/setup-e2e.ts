import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

// Mock Firebase Admin SDK for e2e tests
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
      add: jest.fn(),
      get: jest.fn(),
    })),
  })),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  })),
}));

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock PayPal
jest.mock('@paypal/paypal-server-sdk', () => ({
  PayPalApi: jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn(),
      capture: jest.fn(),
    },
  })),
}));

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
  process.env.FIREBASE_PRIVATE_KEY = 'test-key';
  process.env.JWT_SECRET = 'test-secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.PAYPAL_CLIENT_ID = 'test-paypal-id';
  process.env.PAYPAL_CLIENT_SECRET = 'test-paypal-secret';
});

// Helper function to create test app
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}