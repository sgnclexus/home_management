import { Injectable, Logger } from '@nestjs/common';
import { 
  NotificationPreferences,
  UpdateNotificationPreferencesDto,
  NotificationType,
  DeliveryChannel,
  NotificationPriority
} from '@home-management/types';
import { FirebaseConfigService } from '../../config/firebase.config';
import { Firestore, FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);
  private readonly firestore: Firestore;

  constructor(private readonly firebaseService: FirebaseConfigService) {
    this.firestore = this.firebaseService.getFirestore();
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const doc = await this.firestore
        .collection('notification_preferences')
        .doc(userId)
        .get();

      if (!doc.exists) {
        // Create default preferences
        const defaultPreferences = this.createDefaultPreferences(userId);
        await this.createUserPreferences(defaultPreferences);
        return defaultPreferences;
      }

      return this.deserializePreferences(doc.data());
    } catch (error) {
      this.logger.error(`Failed to get user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updates: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences: NotificationPreferences = {
        ...currentPreferences,
        ...updates,
        updatedAt: new Date(),
        typePreferences: currentPreferences.typePreferences,
      };

      // Merge type preferences if provided
      if (updates.typePreferences) {
        updatedPreferences.typePreferences = {
          ...currentPreferences.typePreferences,
          ...updates.typePreferences,
        } as Record<NotificationType, {
          enabled: boolean;
          channels: DeliveryChannel[];
          priority: NotificationPriority;
        }>;
      }

      await this.firestore
        .collection('notification_preferences')
        .doc(userId)
        .set(this.serializePreferences(updatedPreferences), { merge: true });

      return updatedPreferences;
    } catch (error) {
      this.logger.error(`Failed to update user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create default notification preferences for a new user
   */
  private createDefaultPreferences(userId: string): NotificationPreferences {
    const defaultTypePreferences: Record<NotificationType, {
      enabled: boolean;
      channels: DeliveryChannel[];
      priority: NotificationPriority;
    }> = {
      // Reservation notifications
      reservation_confirmation: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      reservation_update: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      reservation_cancellation: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      reservation_reminder: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'high',
      },
      
      // Meeting notifications
      meeting_scheduled: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      meeting_updated: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      meeting_cancelled: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'high',
      },
      meeting_rescheduled: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'high',
      },
      meeting_notes_published: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      
      // Voting notifications
      vote_created: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'high',
      },
      vote_closed: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
      
      // Agreement notifications
      agreement_activated: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'high',
      },
      
      // Payment notifications
      payment_due: {
        enabled: true,
        channels: ['push', 'in_app', 'email'],
        priority: 'high',
      },
      payment_overdue: {
        enabled: true,
        channels: ['push', 'in_app', 'email'],
        priority: 'urgent',
      },
      payment_confirmed: {
        enabled: true,
        channels: ['push', 'in_app', 'email'],
        priority: 'normal',
      },
      
      // System notifications
      system_announcement: {
        enabled: true,
        channels: ['push', 'in_app'],
        priority: 'normal',
      },
    };

    return {
      id: userId,
      userId,
      enablePush: true,
      enableEmail: true,
      enableSms: false,
      enableInApp: true,
      quietHours: {
        start: '22:00',
        end: '08:00',
      },
      typePreferences: defaultTypePreferences,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create user preferences in database
   */
  private async createUserPreferences(preferences: NotificationPreferences): Promise<void> {
    await this.firestore
      .collection('notification_preferences')
      .doc(preferences.userId)
      .set(this.serializePreferences(preferences));
  }

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const defaultPreferences = this.createDefaultPreferences(userId);
      await this.createUserPreferences(defaultPreferences);
      return defaultPreferences;
    } catch (error) {
      this.logger.error(`Failed to reset user preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Enable/disable specific notification type for user
   */
  async toggleNotificationType(
    userId: string, 
    notificationType: NotificationType, 
    enabled: boolean
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (preferences.typePreferences[notificationType]) {
        preferences.typePreferences[notificationType].enabled = enabled;
        preferences.updatedAt = new Date();
        
        await this.firestore
          .collection('notification_preferences')
          .doc(userId)
          .set(this.serializePreferences(preferences), { merge: true });
      }
    } catch (error) {
      this.logger.error(`Failed to toggle notification type: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update quiet hours for user
   */
  async updateQuietHours(
    userId: string, 
    quietHours: { start: string; end: string } | null
  ): Promise<void> {
    try {
      await this.firestore
        .collection('notification_preferences')
        .doc(userId)
        .update({
          quietHours,
          updatedAt: FieldValue.serverTimestamp(),
        });
    } catch (error) {
      this.logger.error(`Failed to update quiet hours: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Serialization helpers
   */
  private serializePreferences(preferences: NotificationPreferences): any {
    return {
      ...preferences,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  private deserializePreferences(data: any): NotificationPreferences {
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }
}