import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  UpdateNotificationPreferencesDto,
  NotificationQueryDto,
  Notification,
  NotificationPreferences,
  NotificationStatsDto,
} from '@home-management/types';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: jest.Mocked<NotificationService>;
  let preferencesService: jest.Mocked<NotificationPreferencesService>;

  const mockUser = {
    uid: 'user-123',
    email: 'test@example.com',
    role: 'resident',
  };

  const mockNotification: Notification = {
    id: 'notif-123',
    userId: 'user-123',
    type: 'reservation_confirmation',
    title: 'Test Notification',
    body: 'Test message',
    status: 'sent',
    priority: 'normal',
    channels: ['push', 'in_app'],
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    typePreferences: {} as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStats: NotificationStatsDto = {
    totalSent: 100,
    totalDelivered: 95,
    totalFailed: 5,
    deliveryRate: 95,
    averageDeliveryTime: 2.5,
    channelBreakdown: {
      push: { sent: 80, delivered: 78, failed: 2, rate: 97.5 },
      email: { sent: 20, delivered: 17, failed: 3, rate: 85 },
      sms: { sent: 0, delivered: 0, failed: 0, rate: 0 },
      in_app: { sent: 100, delivered: 100, failed: 0, rate: 100 },
    },
    typeBreakdown: {} as any,
  };

  beforeEach(async () => {
    const mockNotificationService = {
      getNotifications: jest.fn(),
      createNotification: jest.fn(),
      createBulkNotification: jest.fn(),
      sendSystemAnnouncement: jest.fn(),
      markNotificationAsRead: jest.fn(),
      markAllNotificationsAsRead: jest.fn(),
      deleteNotification: jest.fn(),
      getNotificationStats: jest.fn(),
    };

    const mockPreferencesService = {
      getUserPreferences: jest.fn(),
      updateUserPreferences: jest.fn(),
      resetUserPreferences: jest.fn(),
      toggleNotificationType: jest.fn(),
      updateQuietHours: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: NotificationPreferencesService,
          useValue: mockPreferencesService,
        },
      ],
    })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<NotificationController>(NotificationController);
    notificationService = module.get(NotificationService);
    preferencesService = module.get(NotificationPreferencesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should get user notifications', async () => {
      const query: NotificationQueryDto = { unreadOnly: true };
      notificationService.getNotifications.mockResolvedValue([mockNotification]);

      const result = await controller.getNotifications(mockUser, query);

      expect(result).toEqual([mockNotification]);
      expect(notificationService.getNotifications).toHaveBeenCalledWith({
        ...query,
        userId: 'user-123',
      });
    });
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const createDto: CreateNotificationDto = {
        userId: 'user-456',
        type: 'system_announcement',
        title: 'Test',
        body: 'Test message',
      };
      notificationService.createNotification.mockResolvedValue(mockNotification);

      const result = await controller.createNotification(createDto);

      expect(result).toEqual(mockNotification);
      expect(notificationService.createNotification).toHaveBeenCalledWith(createDto);
    });
  });

  describe('createBulkNotification', () => {
    it('should create bulk notifications', async () => {
      const bulkDto: BulkNotificationDto = {
        userIds: ['user-123', 'user-456'],
        type: 'system_announcement',
        title: 'Bulk Test',
        body: 'Bulk message',
      };
      notificationService.createBulkNotification.mockResolvedValue([mockNotification]);

      const result = await controller.createBulkNotification(bulkDto);

      expect(result).toEqual([mockNotification]);
      expect(notificationService.createBulkNotification).toHaveBeenCalledWith(bulkDto);
    });
  });

  describe('sendSystemAnnouncement', () => {
    it('should send system announcement', async () => {
      const body = {
        title: 'System Update',
        message: 'Maintenance scheduled',
        priority: 'high',
      };
      notificationService.sendSystemAnnouncement.mockResolvedValue();

      await controller.sendSystemAnnouncement(body);

      expect(notificationService.sendSystemAnnouncement).toHaveBeenCalledWith(
        'System Update',
        'Maintenance scheduled',
        undefined,
        'high'
      );
    });

    it('should send system announcement to specific users', async () => {
      const body = {
        title: 'Test',
        message: 'Message',
        userIds: ['user-123'],
        priority: 'normal',
      };
      notificationService.sendSystemAnnouncement.mockResolvedValue();

      await controller.sendSystemAnnouncement(body);

      expect(notificationService.sendSystemAnnouncement).toHaveBeenCalledWith(
        'Test',
        'Message',
        ['user-123'],
        'normal'
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationService.markNotificationAsRead.mockResolvedValue();

      await controller.markAsRead('notif-123', mockUser);

      expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith(
        'notif-123',
        'user-123'
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      notificationService.markAllNotificationsAsRead.mockResolvedValue();

      await controller.markAllAsRead(mockUser);

      expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalledWith('user-123');
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      notificationService.deleteNotification.mockResolvedValue();

      await controller.deleteNotification('notif-123', mockUser);

      expect(notificationService.deleteNotification).toHaveBeenCalledWith(
        'notif-123',
        'user-123'
      );
    });
  });

  describe('getNotificationStats', () => {
    it('should get notification statistics', async () => {
      notificationService.getNotificationStats.mockResolvedValue(mockStats);

      const result = await controller.getNotificationStats(mockUser);

      expect(result).toEqual(mockStats);
      expect(notificationService.getNotificationStats).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined
      );
    });

    it('should get notification statistics with date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      notificationService.getNotificationStats.mockResolvedValue(mockStats);

      const result = await controller.getNotificationStats(mockUser, startDate, endDate);

      expect(result).toEqual(mockStats);
      expect(notificationService.getNotificationStats).toHaveBeenCalledWith(
        'user-123',
        new Date(startDate),
        new Date(endDate)
      );
    });
  });

  describe('getPreferences', () => {
    it('should get user preferences', async () => {
      preferencesService.getUserPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences(mockUser);

      expect(result).toEqual(mockPreferences);
      expect(preferencesService.getUserPreferences).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const updateDto: UpdateNotificationPreferencesDto = {
        enablePush: false,
        enableEmail: true,
      };
      preferencesService.updateUserPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.updatePreferences(mockUser, updateDto);

      expect(result).toEqual(mockPreferences);
      expect(preferencesService.updateUserPreferences).toHaveBeenCalledWith(
        'user-123',
        updateDto
      );
    });
  });

  describe('resetPreferences', () => {
    it('should reset user preferences', async () => {
      preferencesService.resetUserPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.resetPreferences(mockUser);

      expect(result).toEqual(mockPreferences);
      expect(preferencesService.resetUserPreferences).toHaveBeenCalledWith('user-123');
    });
  });

  describe('toggleNotificationType', () => {
    it('should toggle notification type', async () => {
      preferencesService.toggleNotificationType.mockResolvedValue();

      await controller.toggleNotificationType(
        mockUser,
        'payment_due',
        { enabled: false }
      );

      expect(preferencesService.toggleNotificationType).toHaveBeenCalledWith(
        'user-123',
        'payment_due',
        false
      );
    });
  });

  describe('updateQuietHours', () => {
    it('should update quiet hours', async () => {
      const body = { start: '23:00', end: '07:00' };
      preferencesService.updateQuietHours.mockResolvedValue();

      await controller.updateQuietHours(mockUser, body);

      expect(preferencesService.updateQuietHours).toHaveBeenCalledWith(
        'user-123',
        { start: '23:00', end: '07:00' }
      );
    });

    it('should clear quiet hours', async () => {
      const body = { quietHours: null };
      preferencesService.updateQuietHours.mockResolvedValue();

      await controller.updateQuietHours(mockUser, body);

      expect(preferencesService.updateQuietHours).toHaveBeenCalledWith(
        'user-123',
        null
      );
    });
  });
});