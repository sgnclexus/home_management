import { Injectable, Logger } from '@nestjs/common';
import { 
  Reservation, 
  Meeting, 
  Vote, 
  Agreement, 
  Payment,
  NotificationTemplate,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  DeliveryChannel,
  Notification,
  NotificationPreferences,
  NotificationDeliveryLog,
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationQueryDto,
  NotificationStatsDto
} from '@home-management/types';
import { FirebaseConfigService } from '../../config/firebase.config';
import { UsersService } from '../users/users.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { Firestore, FieldValue } from 'firebase-admin/firestore';
import { Messaging } from 'firebase-admin/messaging';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly firestore: Firestore;
  private readonly messaging: Messaging;

  constructor(
    private readonly firebaseService: FirebaseConfigService,
    private readonly usersService: UsersService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {
    this.firestore = this.firebaseService.getFirestore();
    this.messaging = this.firebaseService.getMessaging();
  }

  /**
   * Create and send a notification
   */
  async createNotification(notificationData: CreateNotificationDto): Promise<Notification> {
    try {
      const notification: Notification = {
        id: this.firestore.collection('notifications').doc().id,
        ...notificationData,
        status: 'pending' as NotificationStatus,
        priority: notificationData.priority || 'normal',
        channels: notificationData.channels || ['push', 'in_app'],
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save notification to database
      await this.firestore
        .collection('notifications')
        .doc(notification.id)
        .set(this.serializeNotification(notification));

      // Send immediately if not scheduled
      if (!notification.scheduledAt || notification.scheduledAt <= new Date()) {
        await this.sendNotification(notification);
      } else {
        await this.scheduleNotification(notification);
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Send bulk notifications to multiple users
   */
  async createBulkNotification(bulkData: BulkNotificationDto): Promise<Notification[]> {
    try {
      const notifications: Notification[] = bulkData.userIds.map(userId => ({
        id: this.firestore.collection('notifications').doc().id,
        userId,
        type: bulkData.type,
        title: bulkData.title,
        body: bulkData.body,
        data: bulkData.data,
        status: 'pending' as NotificationStatus,
        priority: bulkData.priority || 'normal',
        channels: bulkData.channels || ['push', 'in_app'],
        scheduledAt: bulkData.scheduledAt,
        expiresAt: bulkData.expiresAt,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Batch write notifications
      const batch = this.firestore.batch();
      notifications.forEach(notification => {
        const docRef = this.firestore.collection('notifications').doc(notification.id);
        batch.set(docRef, this.serializeNotification(notification));
      });
      await batch.commit();

      // Send notifications
      const sendPromises = notifications.map(notification => {
        if (!notification.scheduledAt || notification.scheduledAt <= new Date()) {
          return this.sendNotification(notification);
        } else {
          return this.scheduleNotification(notification);
        }
      });

      await Promise.allSettled(sendPromises);
      return notifications;
    } catch (error) {
      this.logger.error(`Failed to create bulk notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Send notification through configured channels
   */
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(notification.userId);
      const user = await this.usersService.findByUid(notification.userId);

      if (!user || !user.isActive) {
        await this.updateNotificationStatus(notification.id, 'failed', 'User not found or inactive');
        return;
      }

      // Check if notification type is enabled for user
      const typePreference = preferences?.typePreferences?.[notification.type];
      if (typePreference && !typePreference.enabled) {
        await this.updateNotificationStatus(notification.id, 'cancelled', 'Notification type disabled by user');
        return;
      }

      // Check quiet hours
      if (preferences && this.isInQuietHours(preferences)) {
        // Reschedule for after quiet hours
        const nextSendTime = this.getNextSendTime(preferences);
        await this.rescheduleNotification(notification.id, nextSendTime);
        return;
      }

      // Determine channels to use
      const channelsToUse = this.getChannelsToUse(notification, preferences);
      
      // Send through each channel
      const deliveryPromises = channelsToUse.map(channel => 
        this.sendThroughChannel(notification, user, channel)
      );

      const results = await Promise.allSettled(deliveryPromises);
      
      // Check if at least one channel succeeded
      const hasSuccess = results.some(result => result.status === 'fulfilled');
      
      if (hasSuccess) {
        await this.updateNotificationStatus(notification.id, 'sent');
      } else {
        await this.handleNotificationFailure(notification);
      }

    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.handleNotificationFailure(notification, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Send notification through specific channel
   */
  private async sendThroughChannel(
    notification: Notification, 
    user: any, 
    channel: DeliveryChannel
  ): Promise<void> {
    const deliveryLog: NotificationDeliveryLog = {
      id: this.firestore.collection('notification_delivery_logs').doc().id,
      notificationId: notification.id,
      userId: notification.userId,
      channel,
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      switch (channel) {
        case 'push':
          await this.sendPushNotification(notification, user, deliveryLog);
          break;
        case 'in_app':
          await this.sendInAppNotification(notification, deliveryLog);
          break;
        case 'email':
          await this.sendEmailNotification(notification, user, deliveryLog);
          break;
        case 'sms':
          await this.sendSmsNotification(notification, user, deliveryLog);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      // Log successful delivery
      deliveryLog.status = 'delivered';
      deliveryLog.deliveredAt = new Date();
      
    } catch (error) {
      deliveryLog.status = 'failed';
      deliveryLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send ${channel} notification: ${deliveryLog.errorMessage}`);
    } finally {
      // Save delivery log
      await this.firestore
        .collection('notification_delivery_logs')
        .doc(deliveryLog.id)
        .set(this.serializeDeliveryLog(deliveryLog));
    }
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(
    notification: Notification, 
    user: any, 
    deliveryLog: NotificationDeliveryLog
  ): Promise<void> {
    if (!user.fcmToken) {
      throw new Error('User has no FCM token');
    }

    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: this.serializeNotificationData(notification.data || {}),
      android: {
        notification: {
          channelId: this.getChannelId(notification.type),
          priority: this.getAndroidPriority(notification.priority),
          icon: 'ic_notification',
          color: '#2196F3',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: await this.getUnreadCount(notification.userId),
            sound: 'default',
            category: notification.type,
          },
        },
      },
    };

    const response = await this.messaging.send(message);
    deliveryLog.provider = 'FCM';
    deliveryLog.providerMessageId = response;
  }

  /**
   * Send in-app notification (store in database)
   */
  private async sendInAppNotification(
    notification: Notification, 
    deliveryLog: NotificationDeliveryLog
  ): Promise<void> {
    // In-app notifications are already stored in the notifications collection
    // Just mark as delivered
    deliveryLog.provider = 'in_app';
    deliveryLog.providerMessageId = notification.id;
  }

  /**
   * Send email notification (placeholder - would integrate with email service)
   */
  private async sendEmailNotification(
    notification: Notification, 
    user: any, 
    deliveryLog: NotificationDeliveryLog
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, SES, etc.)
    this.logger.log(`Email notification would be sent to ${user.email}: ${notification.title}`);
    deliveryLog.provider = 'email';
    deliveryLog.providerMessageId = `email_${Date.now()}`;
  }

  /**
   * Send SMS notification (placeholder - would integrate with SMS service)
   */
  private async sendSmsNotification(
    notification: Notification, 
    user: any, 
    deliveryLog: NotificationDeliveryLog
  ): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, etc.)
    if (!user.phoneNumber) {
      throw new Error('User has no phone number');
    }
    this.logger.log(`SMS notification would be sent to ${user.phoneNumber}: ${notification.title}`);
    deliveryLog.provider = 'sms';
    deliveryLog.providerMessageId = `sms_${Date.now()}`;
  }

  /**
   * Helper methods for notification management
   */
  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      return await this.preferencesService.getUserPreferences(userId);
    } catch (error) {
      this.logger.error(`Failed to get user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private getNextSendTime(preferences: NotificationPreferences): Date {
    if (!preferences.quietHours) return new Date();

    const now = new Date();
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    
    const nextSend = new Date(now);
    nextSend.setHours(endHour, endMin, 0, 0);
    
    // If end time is tomorrow
    if (nextSend <= now) {
      nextSend.setDate(nextSend.getDate() + 1);
    }

    return nextSend;
  }

  private getChannelsToUse(
    notification: Notification, 
    preferences: NotificationPreferences | null
  ): DeliveryChannel[] {
    if (!preferences) return notification.channels;

    const typePreference = preferences.typePreferences?.[notification.type];
    if (typePreference) {
      return typePreference.channels.filter(channel => {
        switch (channel) {
          case 'push': return preferences.enablePush;
          case 'email': return preferences.enableEmail;
          case 'sms': return preferences.enableSms;
          case 'in_app': return preferences.enableInApp;
          default: return true;
        }
      });
    }

    return notification.channels.filter(channel => {
      switch (channel) {
        case 'push': return preferences.enablePush;
        case 'email': return preferences.enableEmail;
        case 'sms': return preferences.enableSms;
        case 'in_app': return preferences.enableInApp;
        default: return true;
      }
    });
  }

  private async updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus, 
    failureReason?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (status === 'sent') {
      updateData.sentAt = FieldValue.serverTimestamp();
    } else if (status === 'failed' && failureReason) {
      updateData.failureReason = failureReason;
    }

    await this.firestore
      .collection('notifications')
      .doc(notificationId)
      .update(updateData);
  }

  private async handleNotificationFailure(notification: Notification, errorMessage?: string): Promise<void> {
    const newRetryCount = notification.retryCount + 1;
    
    if (newRetryCount < notification.maxRetries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000; // 2^n minutes
      const retryTime = new Date(Date.now() + retryDelay);
      
      await this.firestore
        .collection('notifications')
        .doc(notification.id)
        .update({
          retryCount: newRetryCount,
          scheduledAt: retryTime,
          updatedAt: FieldValue.serverTimestamp(),
        });

      this.logger.log(`Scheduled retry ${newRetryCount} for notification ${notification.id} at ${retryTime}`);
    } else {
      await this.updateNotificationStatus(notification.id, 'failed', errorMessage || 'Max retries exceeded');
    }
  }

  private async rescheduleNotification(notificationId: string, newTime: Date): Promise<void> {
    await this.firestore
      .collection('notifications')
      .doc(notificationId)
      .update({
        scheduledAt: newTime,
        updatedAt: FieldValue.serverTimestamp(),
      });
  }

  private async scheduleNotification(notification: Notification): Promise<void> {
    // In a production environment, this would use a job queue like Bull or Agenda
    // For now, we'll just log the scheduling
    this.logger.log(`Notification ${notification.id} scheduled for ${notification.scheduledAt}`);
  }

  private getChannelId(type: NotificationType): string {
    switch (type) {
      case 'reservation_confirmation':
      case 'reservation_update':
      case 'reservation_cancellation':
      case 'reservation_reminder':
        return 'reservations';
      case 'meeting_scheduled':
      case 'meeting_updated':
      case 'meeting_cancelled':
      case 'meeting_rescheduled':
      case 'meeting_notes_published':
        return 'meetings';
      case 'vote_created':
      case 'vote_closed':
        return 'voting';
      case 'agreement_activated':
        return 'agreements';
      case 'payment_due':
      case 'payment_overdue':
      case 'payment_confirmed':
        return 'payments';
      case 'system_announcement':
        return 'system';
      default:
        return 'general';
    }
  }

  private getAndroidPriority(priority: NotificationPriority): 'min' | 'low' | 'default' | 'high' | 'max' {
    switch (priority) {
      case 'low': return 'low';
      case 'normal': return 'default';
      case 'high': return 'high';
      case 'urgent': return 'max';
      default: return 'default';
    }
  }

  private async getUnreadCount(userId: string): Promise<number> {
    try {
      const snapshot = await this.firestore
        .collection('notifications')
        .where('userId', '==', userId)
        .where('readAt', '==', null)
        .count()
        .get();
      
      return snapshot.data().count;
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  private serializeNotificationData(data: Record<string, any>): Record<string, string> {
    const serialized: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return serialized;
  }

  private serializeNotification(notification: Notification): any {
    return {
      ...notification,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      scheduledAt: notification.scheduledAt ? notification.scheduledAt : null,
      sentAt: notification.sentAt ? notification.sentAt : null,
      deliveredAt: notification.deliveredAt ? notification.deliveredAt : null,
      readAt: notification.readAt ? notification.readAt : null,
      expiresAt: notification.expiresAt ? notification.expiresAt : null,
    };
  }

  private serializeDeliveryLog(log: NotificationDeliveryLog): any {
    return {
      ...log,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deliveredAt: log.deliveredAt ? log.deliveredAt : null,
    };
  }

  private deserializeNotificationPreferences(data: any): NotificationPreferences {
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  /**
   * Send reservation confirmation notification
   */
  async sendReservationConfirmation(reservation: Reservation): Promise<void> {
    const template = this.getReservationConfirmationTemplate(reservation);
    await this.createNotification({
      userId: reservation.userId,
      type: 'reservation_confirmation',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'normal',
      channels: ['push', 'in_app'],
    });
  }

  /**
   * Send reservation update notification
   */
  async sendReservationUpdate(reservation: Reservation): Promise<void> {
    const template = this.getReservationUpdateTemplate(reservation);
    await this.createNotification({
      userId: reservation.userId,
      type: 'reservation_update',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'normal',
      channels: ['push', 'in_app'],
    });
  }

  /**
   * Send reservation cancellation notification
   */
  async sendReservationCancellation(reservation: Reservation): Promise<void> {
    const template = this.getReservationCancellationTemplate(reservation);
    await this.createNotification({
      userId: reservation.userId,
      type: 'reservation_cancellation',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'normal',
      channels: ['push', 'in_app'],
    });
  }

  /**
   * Schedule reservation reminder notification (24 hours before)
   */
  async scheduleReservationReminder(reservation: Reservation): Promise<void> {
    const reminderTime = new Date(reservation.startTime.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    // Only schedule if reminder time is in the future
    if (reminderTime > now) {
      const template = this.getReservationReminderTemplate(reservation);
      await this.createNotification({
        userId: reservation.userId,
        type: 'reservation_reminder',
        title: template.title,
        body: template.body,
        data: template.data,
        priority: 'high',
        channels: ['push', 'in_app'],
        scheduledAt: reminderTime,
      });

      this.logger.log(`Reservation reminder scheduled for ${reminderTime.toISOString()}`);
    }
  }

  /**
   * Payment notification methods
   */
  async sendPaymentDueNotification(payment: Payment): Promise<void> {
    const template = this.getPaymentDueTemplate(payment);
    await this.createNotification({
      userId: payment.userId,
      type: 'payment_due',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'high',
      channels: ['push', 'in_app', 'email'],
    });
  }

  async sendPaymentOverdueNotification(payment: Payment): Promise<void> {
    const template = this.getPaymentOverdueTemplate(payment);
    await this.createNotification({
      userId: payment.userId,
      type: 'payment_overdue',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'urgent',
      channels: ['push', 'in_app', 'email'],
    });
  }

  async sendPaymentConfirmationNotification(payment: Payment): Promise<void> {
    const template = this.getPaymentConfirmationTemplate(payment);
    await this.createNotification({
      userId: payment.userId,
      type: 'payment_confirmed',
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'normal',
      channels: ['push', 'in_app', 'email'],
    });
  }

  /**
   * System announcement notification
   */
  async sendSystemAnnouncement(
    title: string, 
    body: string, 
    userIds?: string[], 
    priority: NotificationPriority = 'normal'
  ): Promise<void> {
    let targetUserIds = userIds;
    
    if (!targetUserIds) {
      // Send to all active users
      const users = await this.usersService.findActiveUsers();
      targetUserIds = users.map(user => user.uid);
    }

    await this.createBulkNotification({
      userIds: targetUserIds,
      type: 'system_announcement',
      title,
      body,
      priority,
      channels: ['push', 'in_app'],
    });
  }

  /**
   * Notification management methods
   */
  async getNotifications(query: NotificationQueryDto): Promise<Notification[]> {
    try {
      let firestoreQuery = this.firestore.collection('notifications') as any;

      if (query.userId) {
        firestoreQuery = firestoreQuery.where('userId', '==', query.userId);
      }
      if (query.type) {
        firestoreQuery = firestoreQuery.where('type', '==', query.type);
      }
      if (query.status) {
        firestoreQuery = firestoreQuery.where('status', '==', query.status);
      }
      if (query.priority) {
        firestoreQuery = firestoreQuery.where('priority', '==', query.priority);
      }
      if (query.unreadOnly) {
        firestoreQuery = firestoreQuery.where('readAt', '==', null);
      }
      if (query.startDate) {
        firestoreQuery = firestoreQuery.where('createdAt', '>=', query.startDate);
      }
      if (query.endDate) {
        firestoreQuery = firestoreQuery.where('createdAt', '<=', query.endDate);
      }

      firestoreQuery = firestoreQuery.orderBy('createdAt', 'desc').limit(100);

      const snapshot = await firestoreQuery.get();
      return snapshot.docs.map((doc: any) => this.deserializeNotification(doc.data()));
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.firestore
        .collection('notifications')
        .doc(notificationId)
        .update({
          readAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const snapshot = await this.firestore
        .collection('notifications')
        .where('userId', '==', userId)
        .where('readAt', '==', null)
        .get();

      const batch = this.firestore.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          readAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const doc = await this.firestore
        .collection('notifications')
        .doc(notificationId)
        .get();

      if (!doc.exists) {
        throw new Error('Notification not found');
      }

      const notification = doc.data();
      if (notification?.userId !== userId) {
        throw new Error('Unauthorized to delete this notification');
      }

      await doc.ref.delete();
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getNotificationStats(userId?: string, startDate?: Date, endDate?: Date): Promise<NotificationStatsDto> {
    try {
      let query = this.firestore.collection('notification_delivery_logs') as any;

      if (userId) {
        query = query.where('userId', '==', userId);
      }
      if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      }
      if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      const snapshot = await query.get();
      const logs = snapshot.docs.map((doc: any) => doc.data());

      const totalSent = logs.length;
      const totalDelivered = logs.filter(log => log.status === 'delivered').length;
      const totalFailed = logs.filter(log => log.status === 'failed').length;
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

      // Calculate average delivery time
      const deliveredLogs = logs.filter(log => log.status === 'delivered' && log.deliveredAt);
      const averageDeliveryTime = deliveredLogs.length > 0 
        ? deliveredLogs.reduce((sum, log) => {
            const deliveryTime = log.deliveredAt.toDate().getTime() - log.createdAt.toDate().getTime();
            return sum + deliveryTime;
          }, 0) / deliveredLogs.length / 1000 // Convert to seconds
        : 0;

      // Channel breakdown
      const channelBreakdown: Record<DeliveryChannel, any> = {
        push: { sent: 0, delivered: 0, failed: 0, rate: 0 },
        email: { sent: 0, delivered: 0, failed: 0, rate: 0 },
        sms: { sent: 0, delivered: 0, failed: 0, rate: 0 },
        in_app: { sent: 0, delivered: 0, failed: 0, rate: 0 },
      };

      logs.forEach(log => {
        const channel = log.channel as DeliveryChannel;
        if (channelBreakdown[channel]) {
          channelBreakdown[channel].sent++;
          if (log.status === 'delivered') {
            channelBreakdown[channel].delivered++;
          } else if (log.status === 'failed') {
            channelBreakdown[channel].failed++;
          }
        }
      });

      // Calculate rates
      Object.keys(channelBreakdown).forEach(channel => {
        const ch = channel as DeliveryChannel;
        const sent = channelBreakdown[ch].sent;
        channelBreakdown[ch].rate = sent > 0 ? (channelBreakdown[ch].delivered / sent) * 100 : 0;
      });

      // Type breakdown (would need to join with notifications collection for full implementation)
      const typeBreakdown: Record<NotificationType, any> = {} as any;

      return {
        totalSent,
        totalDelivered,
        totalFailed,
        deliveryRate,
        averageDeliveryTime,
        channelBreakdown,
        typeBreakdown,
      };
    } catch (error) {
      this.logger.error(`Failed to get notification stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private deserializeNotification(data: any): Notification {
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      scheduledAt: data.scheduledAt?.toDate() || undefined,
      sentAt: data.sentAt?.toDate() || undefined,
      deliveredAt: data.deliveredAt?.toDate() || undefined,
      readAt: data.readAt?.toDate() || undefined,
      expiresAt: data.expiresAt?.toDate() || undefined,
    };
  }

  /**
   * Notification template generators
   */
  private getReservationConfirmationTemplate(reservation: Reservation): NotificationTemplate {
    const startTime = reservation.startTime.toLocaleString();
    
    return {
      title: 'Reservation Confirmed',
      body: `Your reservation for ${reservation.areaName} on ${startTime} has been confirmed.`,
      data: {
        type: 'reservation_confirmation',
        reservationId: reservation.id,
        areaId: reservation.areaId,
        startTime: reservation.startTime.toISOString(),
      },
      priority: 'normal',
      channels: ['push', 'in_app'],
    };
  }

  private getReservationUpdateTemplate(reservation: Reservation): NotificationTemplate {
    const startTime = reservation.startTime.toLocaleString();
    
    return {
      title: 'Reservation Updated',
      body: `Your reservation for ${reservation.areaName} has been updated. New time: ${startTime}`,
      data: {
        type: 'reservation_update',
        reservationId: reservation.id,
        areaId: reservation.areaId,
        startTime: reservation.startTime.toISOString(),
      },
      priority: 'normal',
      channels: ['push', 'in_app'],
    };
  }

  private getReservationCancellationTemplate(reservation: Reservation): NotificationTemplate {
    return {
      title: 'Reservation Cancelled',
      body: `Your reservation for ${reservation.areaName} has been cancelled.`,
      data: {
        type: 'reservation_cancellation',
        reservationId: reservation.id,
        areaId: reservation.areaId,
      },
      priority: 'normal',
      channels: ['push', 'in_app'],
    };
  }

  private getReservationReminderTemplate(reservation: Reservation): NotificationTemplate {
    const startTime = reservation.startTime.toLocaleString();
    
    return {
      title: 'Reservation Reminder',
      body: `Don't forget! Your reservation for ${reservation.areaName} is tomorrow at ${startTime}.`,
      data: {
        type: 'reservation_reminder',
        reservationId: reservation.id,
        areaId: reservation.areaId,
        startTime: reservation.startTime.toISOString(),
      },
      priority: 'high',
      channels: ['push', 'in_app'],
    };
  }

  private getPaymentDueTemplate(payment: Payment): NotificationTemplate {
    const dueDate = payment.dueDate.toLocaleDateString();
    
    return {
      title: 'Payment Due',
      body: `Your maintenance fee of $${payment.amount} is due on ${dueDate}.`,
      data: {
        type: 'payment_due',
        paymentId: payment.id,
        amount: payment.amount.toString(),
        dueDate: payment.dueDate.toISOString(),
      },
      priority: 'high',
      channels: ['push', 'in_app', 'email'],
    };
  }

  private getPaymentOverdueTemplate(payment: Payment): NotificationTemplate {
    const dueDate = payment.dueDate.toLocaleDateString();
    
    return {
      title: 'Payment Overdue',
      body: `Your maintenance fee of $${payment.amount} was due on ${dueDate}. Please pay as soon as possible.`,
      data: {
        type: 'payment_overdue',
        paymentId: payment.id,
        amount: payment.amount.toString(),
        dueDate: payment.dueDate.toISOString(),
      },
      priority: 'urgent',
      channels: ['push', 'in_app', 'email'],
    };
  }

  private getPaymentConfirmationTemplate(payment: Payment): NotificationTemplate {
    return {
      title: 'Payment Confirmed',
      body: `Your payment of $${payment.amount} has been successfully processed.`,
      data: {
        type: 'payment_confirmed',
        paymentId: payment.id,
        amount: payment.amount.toString(),
        paidDate: payment.paidDate?.toISOString() || new Date().toISOString(),
      },
      priority: 'normal',
      channels: ['push', 'in_app', 'email'],
    };
  }

  /**
   * Meeting notification methods
   */
  async sendMeetingNotification(
    meeting: Meeting,
    notificationType: 'meeting_scheduled' | 'meeting_updated' | 'meeting_cancelled' | 'meeting_rescheduled' | 'meeting_notes_published',
    attendeeIds: string[]
  ): Promise<void> {
    const template = this.getMeetingNotificationTemplate(meeting, notificationType);
    const priority = notificationType === 'meeting_cancelled' ? 'high' : 'normal';
    
    await this.createBulkNotification({
      userIds: attendeeIds,
      type: notificationType as NotificationType,
      title: template.title,
      body: template.body,
      data: template.data,
      priority,
      channels: ['push', 'in_app'],
    });
  }

  async sendVoteNotification(
    vote: Vote,
    meeting: Meeting,
    notificationType: 'vote_created' | 'vote_closed',
    attendeeIds: string[]
  ): Promise<void> {
    const template = this.getVoteNotificationTemplate(vote, meeting, notificationType);
    const priority = notificationType === 'vote_created' ? 'high' : 'normal';
    
    await this.createBulkNotification({
      userIds: attendeeIds,
      type: notificationType as NotificationType,
      title: template.title,
      body: template.body,
      data: template.data,
      priority,
      channels: ['push', 'in_app'],
    });
  }

  async sendAgreementNotification(
    agreement: Agreement,
    notificationType: 'agreement_activated'
  ): Promise<void> {
    // Send to all active users (agreements are typically community-wide)
    const users = await this.usersService.findActiveUsers();
    const userIds = users.map(user => user.uid);
    
    const template = this.getAgreementNotificationTemplate(agreement, notificationType);
    
    await this.createBulkNotification({
      userIds,
      type: notificationType as NotificationType,
      title: template.title,
      body: template.body,
      data: template.data,
      priority: 'high',
      channels: ['push', 'in_app'],
    });
  }

  /**
   * Meeting notification template generators
   */
  private getMeetingNotificationTemplate(
    meeting: Meeting,
    notificationType: string
  ): NotificationTemplate {
    const scheduledDate = meeting.scheduledDate.toLocaleString();
    
    switch (notificationType) {
      case 'meeting_scheduled':
        return {
          title: 'New Meeting Scheduled',
          body: `"${meeting.title}" has been scheduled for ${scheduledDate}`,
          data: {
            type: 'meeting_scheduled',
            meetingId: meeting.id,
            scheduledDate: meeting.scheduledDate.toISOString(),
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
      
      case 'meeting_updated':
        return {
          title: 'Meeting Updated',
          body: `"${meeting.title}" has been updated`,
          data: {
            type: 'meeting_updated',
            meetingId: meeting.id,
            scheduledDate: meeting.scheduledDate.toISOString(),
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
      
      case 'meeting_cancelled':
        return {
          title: 'Meeting Cancelled',
          body: `"${meeting.title}" has been cancelled`,
          data: {
            type: 'meeting_cancelled',
            meetingId: meeting.id,
          },
          priority: 'high',
          channels: ['push', 'in_app'],
        };
      
      case 'meeting_rescheduled':
        return {
          title: 'Meeting Rescheduled',
          body: `"${meeting.title}" has been rescheduled to ${scheduledDate}`,
          data: {
            type: 'meeting_rescheduled',
            meetingId: meeting.id,
            scheduledDate: meeting.scheduledDate.toISOString(),
          },
          priority: 'high',
          channels: ['push', 'in_app'],
        };
      
      case 'meeting_notes_published':
        return {
          title: 'Meeting Notes Published',
          body: `Notes for "${meeting.title}" are now available`,
          data: {
            type: 'meeting_notes_published',
            meetingId: meeting.id,
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
      
      default:
        return {
          title: 'Meeting Notification',
          body: `Update for "${meeting.title}"`,
          data: {
            type: 'meeting_notification',
            meetingId: meeting.id,
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
    }
  }

  private getVoteNotificationTemplate(
    vote: Vote,
    meeting: Meeting,
    notificationType: string
  ): NotificationTemplate {
    switch (notificationType) {
      case 'vote_created':
        return {
          title: 'New Vote Available',
          body: `Vote on "${vote.question}" for meeting "${meeting.title}"`,
          data: {
            type: 'vote_created',
            voteId: vote.id,
            meetingId: vote.meetingId,
          },
          priority: 'high',
          channels: ['push', 'in_app'],
        };
      
      case 'vote_closed':
        return {
          title: 'Vote Closed',
          body: `Voting has ended for "${vote.question}"`,
          data: {
            type: 'vote_closed',
            voteId: vote.id,
            meetingId: vote.meetingId,
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
      
      default:
        return {
          title: 'Vote Notification',
          body: `Update for vote "${vote.question}"`,
          data: {
            type: 'vote_notification',
            voteId: vote.id,
            meetingId: vote.meetingId,
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
    }
  }

  private getAgreementNotificationTemplate(
    agreement: Agreement,
    notificationType: string
  ): NotificationTemplate {
    switch (notificationType) {
      case 'agreement_activated':
        return {
          title: 'New Agreement Active',
          body: `"${agreement.title}" is now active and requires your review`,
          data: {
            type: 'agreement_activated',
            agreementId: agreement.id,
          },
          priority: 'high',
          channels: ['push', 'in_app'],
        };
      
      default:
        return {
          title: 'Agreement Notification',
          body: `Update for agreement "${agreement.title}"`,
          data: {
            type: 'agreement_notification',
            agreementId: agreement.id,
          },
          priority: 'normal',
          channels: ['push', 'in_app'],
        };
    }
  }
}