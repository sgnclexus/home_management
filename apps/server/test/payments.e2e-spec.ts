import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole, PaymentStatus } from '@home-management/types';

describe('Payments (e2e)', () => {
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

  describe('Payment Creation and Processing', () => {
    it('should create payment for resident', async () => {
      // Mock authentication
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'resident-id',
          role: UserRole.RESIDENT,
        }),
      });

      // Mock payment creation
      mockFirestore.collection().add.mockResolvedValue({
        id: 'payment-123',
      });

      const paymentData = {
        amount: 500,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        dueDate: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', 'Bearer resident-token')
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('amount', 500);
      expect(response.body).toHaveProperty('status', PaymentStatus.PENDING);
    });

    it('should process payment with Stripe', async () => {
      // Mock authentication
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'payment-123',
          userId: 'resident-id',
          amount: 500,
          status: PaymentStatus.PENDING,
        }),
      });

      // Mock Stripe payment intent
      const mockStripe = require('stripe')();
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 50000, // Stripe uses cents
      });

      const response = await request(app.getHttpServer())
        .post('/payments/payment-123/process')
        .set('Authorization', 'Bearer resident-token')
        .send({
          paymentMethodId: 'pm_test_123',
          provider: 'stripe',
        })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'succeeded');
      expect(response.body).toHaveProperty('transactionId', 'pi_test_123');
    });

    it('should handle payment webhook from Stripe', async () => {
      const mockStripe = require('stripe')();
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            status: 'succeeded',
            amount: 50000,
            metadata: {
              paymentId: 'payment-123',
            },
          },
        },
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().update.mockResolvedValue({});

      await request(app.getHttpServer())
        .post('/payments/webhook/stripe')
        .set('stripe-signature', 'test-signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_123',
              status: 'succeeded',
            },
          },
        })
        .expect(200);
    });
  });

  describe('Payment History and Management', () => {
    it('should get payment history for resident', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            id: 'payment-1',
            data: () => ({
              id: 'payment-1',
              amount: 500,
              status: PaymentStatus.PAID,
              createdAt: new Date(),
            }),
          },
          {
            id: 'payment-2',
            data: () => ({
              id: 'payment-2',
              amount: 500,
              status: PaymentStatus.PENDING,
              createdAt: new Date(),
            }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/payments/history')
        .set('Authorization', 'Bearer resident-token')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('status', PaymentStatus.PAID);
    });

    it('should allow admin to view all payments', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-id',
        email: 'admin@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'admin-id',
          role: UserRole.ADMIN,
        }),
      });

      mockFirestore.collection().get.mockResolvedValue({
        docs: [
          {
            id: 'payment-1',
            data: () => ({
              id: 'payment-1',
              userId: 'resident-1',
              amount: 500,
              status: PaymentStatus.PAID,
            }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/payments/admin/all')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  describe('Payment Audit and Logging', () => {
    it('should log payment transactions', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      const mockLogCollection = {
        doc: jest.fn(() => ({
          set: jest.fn(),
        })),
      };
      
      mockFirestore.collection.mockImplementation((collectionName) => {
        if (collectionName === 'payment_transaction_logs') {
          return mockLogCollection;
        }
        return {
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                id: 'payment-123',
                userId: 'resident-id',
                amount: 500,
                status: PaymentStatus.PENDING,
              }),
            }),
            update: jest.fn(),
          })),
        };
      });

      const mockStripe = require('stripe')();
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
        amount: 50000,
      });

      await request(app.getHttpServer())
        .post('/payments/payment-123/process')
        .set('Authorization', 'Bearer resident-token')
        .send({
          paymentMethodId: 'pm_test_123',
          provider: 'stripe',
        })
        .expect(200);

      // Verify that audit log was created
      expect(mockLogCollection.doc).toHaveBeenCalled();
    });
  });
});