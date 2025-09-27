import { BaseEntity } from './common.types';

export type NotificationType = 
  | 'reservation_confirmation'
  | 'reservation_update'
  | 'reservation_cancellation'
  | 'reservation_reminder'
  | 'meeting_scheduled'
  | 'meeting_updated'
  | 'meeting_cancelled'
  | 'meeting_rescheduled'
  | 'meeting_notes_published'
  | 'vote_created'
  | 'vote_closed'
  | 'agreement_activated'
  | 'payment_due'
  | 'payment_overdue'
  | 'payment_confirmed'
  | 'system_announcement';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DeliveryChannel = 'push' | 'email' | 'sms' | 'in_app';

export interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  channels?: DeliveryChannel[];
  icon?: string;
  image?: string;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  priority: NotificationPriority;
  channels: DeliveryChannel[];
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  expiresAt?: Date;
}

export interface NotificationPreferences extends BaseEntity {
  userId: string;
  enablePush: boolean;
  enableEmail: boolean;
  enableSms: boolean;
  enableInApp: boolean;
  quietHours?: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  typePreferences: Record<NotificationType, {
    enabled: boolean;
    channels: DeliveryChannel[];
    priority: NotificationPriority;
  }>;
}

export interface NotificationDeliveryLog extends BaseEntity {
  notificationId: string;
  userId: string;
  channel: DeliveryChannel;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  provider?: string; // FCM, SendGrid, Twilio, etc.
  providerMessageId?: string;
  providerResponse?: any;
  errorMessage?: string;
  deliveredAt?: Date;
  metadata?: Record<string, any>;
}

// DTOs
export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  channels?: DeliveryChannel[];
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface BulkNotificationDto {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  channels?: DeliveryChannel[];
  scheduledAt?: Date;
  expiresAt?: Date;
}

export interface UpdateNotificationPreferencesDto {
  enablePush?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
  enableInApp?: boolean;
  quietHours?: {
    start: string;
    end: string;
  };
  typePreferences?: Partial<Record<NotificationType, {
    enabled: boolean;
    channels: DeliveryChannel[];
    priority: NotificationPriority;
  }>>;
}

export interface NotificationQueryDto {
  userId?: string;
  type?: NotificationType;
  status?: NotificationStatus;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
  unreadOnly?: boolean;
}

export interface NotificationStatsDto {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  channelBreakdown: Record<DeliveryChannel, {
    sent: number;
    delivered: number;
    failed: number;
    rate: number;
  }>;
  typeBreakdown: Record<NotificationType, {
    sent: number;
    delivered: number;
    failed: number;
    rate: number;
  }>;
}