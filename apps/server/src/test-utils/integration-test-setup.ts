import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import * as request from 'supertest';

export class IntegrationTestSetup {
  private app: INestApplication;
  private module: TestingModule;

  async setup(): Promise<void> {
    this.module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('FirebaseConfigService')
      .useValue({
        getFirestore: () => ({
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
        }),
        getAuth: () => ({
          verifyIdToken: jest.fn(),
          getUser: jest.fn(),
          setCustomUserClaims: jest.fn(),
        }),
        getMessaging: () => ({
          send: jest.fn(),
          sendMulticast: jest.fn(),
        }),
      })
      .compile();

    this.app = this.module.createNestApplication();
    await this.app.init();
  }

  async teardown(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
    if (this.module) {
      await this.module.close();
    }
  }

  getApp(): INestApplication {
    return this.app;
  }

  getModule(): TestingModule {
    return this.module;
  }

  request(): request.SuperTest<request.Test> {
    return request(this.app.getHttpServer());
  }

  // Helper method to create authenticated requests
  authenticatedRequest(token: string = 'mock-token'): request.SuperTest<request.Test> {
    return this.request().set('Authorization', `Bearer ${token}`);
  }

  // Helper method to create admin requests
  adminRequest(): request.SuperTest<request.Test> {
    return this.authenticatedRequest('admin-token');
  }
}

// Mock authentication for integration tests
export const mockAuthUser = (role: string = 'resident', uid: string = 'test-uid') => ({
  uid,
  email: 'test@example.com',
  role,
  displayName: 'Test User',
});

// Common test data factories
export const testDataFactory = {
  user: (overrides: any = {}) => ({
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'resident',
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    ...overrides,
  }),

  payment: (overrides: any = {}) => ({
    id: 'payment-1',
    userId: 'user-1',
    amount: 100,
    currency: 'USD',
    description: 'Monthly maintenance fee',
    status: 'pending',
    dueDate: new Date().toISOString(),
    ...overrides,
  }),

  reservation: (overrides: any = {}) => ({
    id: 'reservation-1',
    userId: 'user-1',
    areaId: 'area-1',
    areaName: 'Pool',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'confirmed',
    ...overrides,
  }),

  meeting: (overrides: any = {}) => ({
    id: 'meeting-1',
    title: 'Monthly Board Meeting',
    description: 'Regular monthly meeting',
    scheduledDate: new Date().toISOString(),
    agenda: ['Budget review', 'Maintenance updates'],
    status: 'scheduled',
    attendees: ['user-1', 'user-2'],
    createdBy: 'admin-1',
    ...overrides,
  }),
};