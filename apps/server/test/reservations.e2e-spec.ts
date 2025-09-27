import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '@home-management/types';

describe('Reservations (e2e)', () => {
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

  describe('Reservation Booking Flow', () => {
    it('should create reservation for available time slot', async () => {
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

      // Mock availability check (no conflicts)
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [], // No existing reservations
      });

      // Mock common area exists
      mockFirestore.collection().doc().get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'gym',
          name: 'Gym',
          isActive: true,
        }),
      });

      // Mock reservation creation
      mockFirestore.collection().add.mockResolvedValue({
        id: 'reservation-123',
      });

      const reservationData = {
        areaId: 'gym',
        startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
        endTime: new Date('2024-01-15T11:00:00Z').toISOString(),
        notes: 'Personal training session',
      };

      const response = await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', 'Bearer resident-token')
        .send(reservationData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'confirmed');
      expect(response.body).toHaveProperty('areaId', 'gym');
    });

    it('should reject reservation for conflicting time slot', async () => {
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

      // Mock existing reservation (conflict)
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            data: () => ({
              id: 'existing-reservation',
              startTime: new Date('2024-01-15T10:30:00Z'),
              endTime: new Date('2024-01-15T11:30:00Z'),
              status: 'confirmed',
            }),
          },
        ],
      });

      const reservationData = {
        areaId: 'gym',
        startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
        endTime: new Date('2024-01-15T11:00:00Z').toISOString(),
      };

      await request(app.getHttpServer())
        .post('/reservations')
        .set('Authorization', 'Bearer resident-token')
        .send(reservationData)
        .expect(409); // Conflict
    });

    it('should get available time slots for area', async () => {
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

      // Mock existing reservations
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            data: () => ({
              startTime: new Date('2024-01-15T10:00:00Z'),
              endTime: new Date('2024-01-15T11:00:00Z'),
              status: 'confirmed',
            }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/reservations/availability/gym')
        .query({ date: '2024-01-15' })
        .set('Authorization', 'Bearer resident-token')
        .expect(200);

      expect(response.body).toHaveProperty('availableSlots');
      expect(Array.isArray(response.body.availableSlots)).toBe(true);
    });
  });

  describe('Reservation Management', () => {
    it('should get user reservations', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().where().get.mockResolvedValue({
        docs: [
          {
            id: 'reservation-1',
            data: () => ({
              id: 'reservation-1',
              areaId: 'gym',
              startTime: new Date('2024-01-15T10:00:00Z'),
              endTime: new Date('2024-01-15T11:00:00Z'),
              status: 'confirmed',
            }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/reservations/my')
        .set('Authorization', 'Bearer resident-token')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('areaId', 'gym');
    });

    it('should cancel reservation', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'reservation-123',
          userId: 'resident-id',
          status: 'confirmed',
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        }),
      });

      mockFirestore.collection().doc().update.mockResolvedValue({});

      await request(app.getHttpServer())
        .patch('/reservations/reservation-123/cancel')
        .set('Authorization', 'Bearer resident-token')
        .expect(200);
    });

    it('should prevent cancellation within 24 hours', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'resident-id',
        email: 'resident@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'reservation-123',
          userId: 'resident-id',
          status: 'confirmed',
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        }),
      });

      await request(app.getHttpServer())
        .patch('/reservations/reservation-123/cancel')
        .set('Authorization', 'Bearer resident-token')
        .expect(400);
    });
  });

  describe('Admin Reservation Management', () => {
    it('should allow admin to view all reservations', async () => {
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
            id: 'reservation-1',
            data: () => ({
              id: 'reservation-1',
              userId: 'resident-1',
              areaId: 'gym',
              status: 'confirmed',
            }),
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/reservations/admin/all')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('should allow admin to cancel any reservation', async () => {
      const mockAuth = require('firebase-admin').auth();
      mockAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-id',
        email: 'admin@example.com',
      });

      const mockFirestore = require('firebase-admin').firestore();
      mockFirestore.collection().doc().get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          uid: 'admin-id',
          role: UserRole.ADMIN,
        }),
      });

      mockFirestore.collection().doc().get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'reservation-123',
          userId: 'resident-id',
          status: 'confirmed',
        }),
      });

      mockFirestore.collection().doc().update.mockResolvedValue({});

      await request(app.getHttpServer())
        .patch('/reservations/reservation-123/cancel')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });
});