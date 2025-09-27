import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '@home-management/types';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/auth (POST)', () => {
    it('should authenticate user with valid token', async () => {
      const mockToken = 'valid-firebase-token';
      
      // Mock Firebase auth verification
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'test-user-id',
        email: 'test@example.com',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: mockToken })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('uid', 'test-user-id');
    });

    it('should reject invalid token', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await request(app.getHttpServer())
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('/auth/profile (GET)', () => {
    it('should return user profile for authenticated user', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'test-user-id',
        email: 'test@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'test-user-id',
          email: 'test@example.com',
          role: UserRole.RESIDENT,
          displayName: 'Test User',
        }),
      });

      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('uid', 'test-user-id');
      expect(response.body).toHaveProperty('role', UserRole.RESIDENT);
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin access to admin endpoints', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-user-id',
        email: 'admin@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'admin-user-id',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        }),
      });

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });

    it('should deny resident access to admin endpoints', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-user-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'resident-user-id',
          email: 'resident@example.com',
          role: UserRole.RESIDENT,
        }),
      });

      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer resident-token')
        .expect(403);
    });
  });
});