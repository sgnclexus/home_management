import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesService } from './notification-preferences.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { 
  NotificationPreferences,
  UpdateNotificationPreferencesDto,
  NotificationType
} from '@home-management/types';
import { Logger } from '@nestjs/common';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let firebaseService: jest.Mocked<FirebaseConfigService>;
  let mockFirestore: jest.Mocked<any>;

  const mockPreferences: NotificationPreferences = {
    id: 'user-123',
    userId: 'user-123',
    enablePush: true,
    enableEmail: true,
    enableSms: false,
    enableInApp: true,
    quietHours: {
      start: '22:00',
      end: '08:00',
    },
    typePreferences: {
      reservation_confirmation: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      payment_due: {
        enabled: true,
        channels: ['push', 'in_app', 'email'],
        priority: 'high',
      },
    } as any,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      exists: true,
      data: jest.fn().mockReturnValue({
        ...mockPreferences,
        createdAt: { toDate: () => mockPreferences.createdAt },
        updatedAt: { toDate: () => mockPreferences.updatedAt },
      }),
    };

    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
    };

    mockFirestore = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    const mockFirebaseService = {
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
    firebaseService = module.get(FirebaseConfigService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPreferences', () => {
    it('should return existing user preferences', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          ...mockPreferences,
          createdAt: { toDate: () => mockPreferences.createdAt },
          updatedAt: { toDate: () => mockPreferences.updatedAt },
        }),
      });

      const result = await service.getUserPreferences('user-123');

      expect(result).toEqual(mockPreferences);
      expect(mockFirestore.collection).toHaveBeenCalledWith('notification_preferences');
      expect(mockDoc.get).toHaveBeenCalled();
    });

    it('should create default preferences for new user', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({ exists: false });
      mockDoc.set.mockResolvedValue(undefined);

      const result = await service.getUserPreferences('new-user');

      expect(result).toBeDefined();
      expect(result.userId).toBe('new-user');
      expect(result.enablePush).toBe(true);
      expect(result.enableInApp).toBe(true);
      expect(result.typePreferences).toBeDefined();
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockRejectedValue(new Error('Database error'));

      await expect(service.getUserPreferences('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences successfully', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          ...mockPreferences,
          createdAt: { toDate: () => mockPreferences.createdAt },
          updatedAt: { toDate: () => mockPreferences.updatedAt },
        }),
      });
      mockDoc.set.mockResolvedValue(undefined);

      const updates: UpdateNotificationPreferencesDto = {
        enablePush: false,
        enableEmail: true,
        quietHours: {
          start: '23:00',
          end: '07:00',
        },
      };

      const result = await service.updateUserPreferences('user-123', updates);

      expect(result.enablePush).toBe(false);
      expect(result.enableEmail).toBe(true);
      expect(result.quietHours?.start).toBe('23:00');
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          enablePush: false,
          enableEmail: true,
        }),
        { merge: true }
      );
    });

    it('should merge type preferences correctly', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          ...mockPreferences,
          createdAt: { toDate: () => mockPreferences.createdAt },
          updatedAt: { toDate: () => mockPreferences.updatedAt },
        }),
      });
      mockDoc.set.mockResolvedValue(undefined);

      const updates: UpdateNotificationPreferencesDto = {
        typePreferences: {
          payment_due: {
            enabled: false,
            channels: ['email'],
            priority: 'low',
          },
        },
      };

      const result = await service.updateUserPreferences('user-123', updates);

      expect(result.typePreferences.payment_due.enabled).toBe(false);
      expect(result.typePreferences.reservation_confirmation.enabled).toBe(true); // Should preserve existing
    });
  });

  describe('resetUserPreferences', () => {
    it('should reset preferences to defaults', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.set.mockResolvedValue(undefined);

      const result = await service.resetUserPreferences('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.enablePush).toBe(true);
      expect(result.enableInApp).toBe(true);
      expect(result.typePreferences).toBeDefined();
      expect(mockDoc.set).toHaveBeenCalled();
    });
  });

  describe('toggleNotificationType', () => {
    it('should toggle notification type successfully', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          ...mockPreferences,
          createdAt: { toDate: () => mockPreferences.createdAt },
          updatedAt: { toDate: () => mockPreferences.updatedAt },
        }),
      });
      mockDoc.set.mockResolvedValue(undefined);

      await service.toggleNotificationType('user-123', 'payment_due', false);

      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          typePreferences: expect.objectContaining({
            payment_due: expect.objectContaining({
              enabled: false,
            }),
          }),
        }),
        { merge: true }
      );
    });

    it('should handle non-existent notification type gracefully', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({
        exists: true,
        data: () => ({
          ...mockPreferences,
          typePreferences: {},
          createdAt: { toDate: () => mockPreferences.createdAt },
          updatedAt: { toDate: () => mockPreferences.updatedAt },
        }),
      });

      await service.toggleNotificationType('user-123', 'payment_due', false);

      // Should not call set if type doesn't exist
      expect(mockDoc.set).not.toHaveBeenCalled();
    });
  });

  describe('updateQuietHours', () => {
    it('should update quiet hours successfully', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.update.mockResolvedValue(undefined);

      const quietHours = { start: '23:30', end: '06:30' };
      await service.updateQuietHours('user-123', quietHours);

      expect(mockDoc.update).toHaveBeenCalledWith({
        quietHours,
        updatedAt: expect.any(Object), // FieldValue.serverTimestamp()
      });
    });

    it('should clear quiet hours when null is provided', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.update.mockResolvedValue(undefined);

      await service.updateQuietHours('user-123', null);

      expect(mockDoc.update).toHaveBeenCalledWith({
        quietHours: null,
        updatedAt: expect.any(Object),
      });
    });
  });

  describe('default preferences creation', () => {
    it('should create comprehensive default preferences', async () => {
      const mockDoc = mockFirestore.collection().doc();
      mockDoc.get.mockResolvedValue({ exists: false });
      mockDoc.set.mockResolvedValue(undefined);

      const result = await service.getUserPreferences('new-user');

      // Check that all notification types have default preferences
      const expectedTypes: NotificationType[] = [
        'reservation_confirmation',
        'reservation_update',
        'reservation_cancellation',
        'reservation_reminder',
        'meeting_scheduled',
        'meeting_updated',
        'meeting_cancelled',
        'meeting_rescheduled',
        'meeting_notes_published',
        'vote_created',
        'vote_closed',
        'agreement_activated',
        'payment_due',
        'payment_overdue',
        'payment_confirmed',
        'system_announcement',
      ];

      expectedTypes.forEach(type => {
        expect(result.typePreferences[type]).toBeDefined();
        expect(result.typePreferences[type].enabled).toBeDefined();
        expect(result.typePreferences[type].channels).toBeDefined();
        expect(result.typePreferences[type].priority).toBeDefined();
      });

      expect(result.quietHours).toEqual({
        start: '22:00',
        end: '08:00',
      });
    });
  });
});