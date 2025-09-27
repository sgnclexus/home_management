import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { UsersService } from '../users/users.service';
import { 
  Reservation, 
  UserRole, 
  Meeting, 
  Vote, 
  Agreement, 
  Payment,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  DeliveryChannel,
  Notification,
  NotificationPreferences,
  CreateNotificationDto,
  BulkNotificationDto
} from '@home-management/types';
import { Logger } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let firebaseService: jest.Mocked<FirebaseConfigService>;
  let usersService: jest.Mocked<UsersService>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;
  let mockMessaging: jest.Mocked<any>;
  let mockFirestore: jest.Mocked<any>;

  const mockReservation: Reservation = {
    id: 'reservation-123',
    userId: 'user-123',
    areaId: 'area-123',
    areaName: 'Swimming Pool',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T12:00:00Z'),
    status: 'confirmed',
    notes: 'Birthday party',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockUser = {
    id: 'user-123',
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.RESIDENT,
    fcmToken: 'mock-fcm-token',
    isActive: true,
    preferredLanguage: 'en' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment: Payment = {
    id: 'payment-123',
    userId: 'user-123',
    amount: 150.00,
    currency: 'USD',
    description: 'Monthly maintenance fee',
    status: 'pending',
    dueDate: new Date('2024-02-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockMeeting: Meeting = {
    id: 'meeting-123',
    title: 'Monthly Board Meeting',
    description: 'Regular monthly meeting',
    scheduledDate: new Date('2024-02-15T19:00:00Z'),
    agenda: ['Budget review', 'Maintenance updates'],
    status: 'scheduled',
    attendees: ['user-123', 'user-456'],
    createdBy: 'admin-123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockMessaging = {
      send: jest.fn(),
    };

    const mockCollection = {
      doc: jest.fn().mockReturnThis(),
      set: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 5 }) }),
      }),
    };

    mockFirestore = {
      collection: jest.fn().mockReturnValue(mockCollection),
      batch: jest.fn().mockReturnValue({
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn(),
      }),
    };

    const mockFirebaseService = {
      getMessaging: jest.fn().mockReturnValue(mockMessaging),
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const mockUsersService = {
      findByUid: jest.fn(),
      findActiveUsers: jest.fn(),
    };

    const mockPreferencesService = {
      getUserPreferences: jest.fn(),
      updateUserPreferences: jest.fn(),
      resetUserPreferences: jest.fn(),
      toggleNotificationType: jest.fn(),
      updateQuietHours: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: NotificationPreferencesService,
          useValue: mockPreferencesService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    firebaseService = module.get(FirebaseConfigService);
    usersService = module.get(UsersService);
    preferencesService = module.get(NotificationPreferencesService);

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

  describe('createNotification', () => {
    it('should create and send notification successfully', async () => {
      const createDto: CreateNotificationDto = {
        userId: 'user-123',
        type: 'reservation_confirmation',
        title: 'Test Notification',
        body: 'Test message',
        priority: 'normal',
        channels: ['push', 'in_app'],
      };

      preferencesService.getUserPreferences.mockResolvedValue(mockPreferences);
      usersService.findByUid.mockResolvedValue(mockUser);
      mockMessaging.send.mockResolvedValue('msg-123');

      const result = await service.createNotification(createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.type).toBe('reservation_confirmation');
      expect(result.status).toBe('pending');
      expect(mockFirestore.collection).toHaveBeenCalledWith('notifications');
    });

    it('should handle scheduled notifications', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const createDto: CreateNotificationDto = {
        userId: 'user-123',
        type: 'reservation_reminder',
        title: 'Scheduled Notification',
        body: 'This is scheduled',
        scheduledAt: futureDate,
      };

      const result = await service.createNotification(createDto);

      expect(result.scheduledAt).toEqual(futureDate);
      expect(mockFirestore.collection).toHaveBeenCalledWith('notifications');
    });
  });

  describe('createBulkNotification', () => {
    it('should create bulk notifications successfully', async () => {
      const bulkDto: BulkNotificationDto = {
        userIds: ['user-123', 'user-456'],
        type: 'system_announcement',
        title: 'System Update',
        body: 'System will be down for maintenance',
        priority: 'high',
      };

      preferencesService.getUserPreferences.mockResolvedValue(mockPreferences);
      usersService.findByUid.mockResolvedValue(mockUser);

      const results = await service.createBulkNotification(bulkDto);

      expect(results).toHaveLength(2);
      expect(results[0].userId).toBe('user-123');
      expect(results[1].userId).toBe('user-456');
      expect(mockFirestore.batch).toHaveBeenCalled();
    });
  });

  describe('sendReservationConfirmation', () => {
    it('should create reservation confirmation notification', async () => {
      const createNotificationSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);

      await service.sendReservationConfirmation(mockReservation);

      expect(createNotificationSpy).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'reservation_confirmation',
        title: 'Reservation Confirmed',
        body: expect.stringContaining('Swimming Pool'),
        data: expect.objectContaining({
          type: 'reservation_confirmation',
          reservationId: 'reservation-123',
        }),
        priority: 'normal',
        channels: ['push', 'in_app'],
      });

      createNotificationSpy.mockRestore();
    });
  });

  describe('sendPaymentDueNotification', () => {
    it('should create payment due notification', async () => {
      const createNotificationSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);

      await service.sendPaymentDueNotification(mockPayment);

      expect(createNotificationSpy).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'payment_due',
        title: 'Payment Due',
        body: expect.stringContaining('$150'),
        data: expect.objectContaining({
          type: 'payment_due',
          paymentId: 'payment-123',
        }),
        priority: 'high',
        channels: ['push', 'in_app', 'email'],
      });

      createNotificationSpy.mockRestore();
    });
  });

  describe('sendMeetingNotification', () => {
    it('should create bulk meeting notification', async () => {
      const createBulkNotificationSpy = jest.spyOn(service, 'createBulkNotification').mockResolvedValue([]);

      await service.sendMeetingNotification(mockMeeting, 'meeting_scheduled', ['user-123', 'user-456']);

      expect(createBulkNotificationSpy).toHaveBeenCalledWith({
        userIds: ['user-123', 'user-456'],
        type: 'meeting_scheduled',
        title: 'New Meeting Scheduled',
        body: expect.stringContaining('Monthly Board Meeting'),
        data: expect.objectContaining({
          type: 'meeting_scheduled',
          meetingId: 'meeting-123',
        }),
        priority: 'normal',
        channels: ['push', 'in_app'],
      });

      createBulkNotificationSpy.mockRestore();
    });
  });

  describe('getNotifications', () => {
    it('should retrieve user notifications', async () => {
      const mockSnapshot = {
        docs: [
          {
            data: () => ({
              id: 'notif-1',
              userId: 'user-123',
              type: 'reservation_confirmation',
              title: 'Test',
              body: 'Test message',
              status: 'sent',
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() },
            }),
          },
        ],
      };

      mockFirestore.collection().where().orderBy().limit().get.mockResolvedValue(mockSnapshot);

      const result = await service.getNotifications({ userId: 'user-123' });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
      expect(mockFirestore.collection).toHaveBeenCalledWith('notifications');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      await service.markNotificationAsRead('notif-123', 'user-123');

      expect(mockFirestore.collection).toHaveBeenCalledWith('notifications');
      expect(mockFirestore.collection().doc).toHaveBeenCalledWith('notif-123');
      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const mockSnapshot = {
        docs: [
          {
            data: () => ({
              channel: 'push',
              status: 'delivered',
              createdAt: { toDate: () => new Date() },
              deliveredAt: { toDate: () => new Date() },
            }),
          },
        ],
      };

      mockFirestore.collection().get.mockResolvedValue(mockSnapshot);

      const result = await service.getNotificationStats('user-123');

      expect(result).toBeDefined();
      expect(result.totalSent).toBe(1);
      expect(result.totalDelivered).toBe(1);
      expect(result.channelBreakdown).toBeDefined();
    });
  });

  describe('scheduleReservationReminder', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule reminder for future reservation', async () => {
      const createNotificationSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);
      
      // Set current time to 2 days before reservation
      const currentTime = new Date('2024-01-13T10:00:00Z');
      jest.setSystemTime(currentTime);

      const futureReservation = {
        ...mockReservation,
        startTime: new Date('2024-01-15T10:00:00Z'), // 2 days in future
      };

      await service.scheduleReservationReminder(futureReservation);

      expect(createNotificationSpy).toHaveBeenCalledWith({
        userId: 'user-123',
        type: 'reservation_reminder',
        title: 'Reservation Reminder',
        body: expect.stringContaining('Swimming Pool'),
        data: expect.objectContaining({
          type: 'reservation_reminder',
          reservationId: 'reservation-123',
        }),
        priority: 'high',
        channels: ['push', 'in_app'],
        scheduledAt: expect.any(Date),
      });

      createNotificationSpy.mockRestore();
    });

    it('should not schedule reminder for past reservation', async () => {
      const createNotificationSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);
      
      // Set current time to after the reservation
      const currentTime = new Date('2024-01-16T10:00:00Z');
      jest.setSystemTime(currentTime);

      await service.scheduleReservationReminder(mockReservation);

      expect(createNotificationSpy).not.toHaveBeenCalled();

      createNotificationSpy.mockRestore();
    });
  });

  describe('sendSystemAnnouncement', () => {
    it('should send announcement to all active users', async () => {
      const activeUsers = [mockUser, { ...mockUser, uid: 'user-456' }];
      usersService.findActiveUsers.mockResolvedValue(activeUsers);
      
      const createBulkNotificationSpy = jest.spyOn(service, 'createBulkNotification').mockResolvedValue([]);

      await service.sendSystemAnnouncement('System Update', 'Maintenance scheduled', undefined, 'high');

      expect(createBulkNotificationSpy).toHaveBeenCalledWith({
        userIds: ['user-123', 'user-456'],
        type: 'system_announcement',
        title: 'System Update',
        body: 'Maintenance scheduled',
        priority: 'high',
        channels: ['push', 'in_app'],
      });

      createBulkNotificationSpy.mockRestore();
    });

    it('should send announcement to specific users', async () => {
      const createBulkNotificationSpy = jest.spyOn(service, 'createBulkNotification').mockResolvedValue([]);

      await service.sendSystemAnnouncement('Test', 'Message', ['user-123'], 'normal');

      expect(createBulkNotificationSpy).toHaveBeenCalledWith({
        userIds: ['user-123'],
        type: 'system_announcement',
        title: 'Test',
        body: 'Message',
        priority: 'normal',
        channels: ['push', 'in_app'],
      });

      createBulkNotificationSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle notification creation errors', async () => {
      mockFirestore.collection().doc().set.mockRejectedValue(new Error('Database error'));

      await expect(service.createNotification({
        userId: 'user-123',
        type: 'reservation_confirmation',
        title: 'Test',
        body: 'Test message',
      })).rejects.toThrow('Database error');
    });

    it('should handle preferences service errors gracefully', async () => {
      preferencesService.getUserPreferences.mockRejectedValue(new Error('Preferences error'));
      usersService.findByUid.mockResolvedValue(mockUser);

      const createDto: CreateNotificationDto = {
        userId: 'user-123',
        type: 'reservation_confirmation',
        title: 'Test',
        body: 'Test message',
      };

      // Should still create notification even if preferences fail
      const result = await service.createNotification(createDto);
      expect(result).toBeDefined();
    });
  });
});