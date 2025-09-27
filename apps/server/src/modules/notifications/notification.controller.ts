import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  UpdateNotificationPreferencesDto,
  NotificationQueryDto,
  NotificationType,
  Notification,
  NotificationPreferences,
  NotificationStatsDto,
} from '@home-management/types';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  /**
   * Get user notifications
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: any,
    @Query() query: NotificationQueryDto,
  ): Promise<Notification[]> {
    // Ensure user can only see their own notifications unless admin
    const queryWithUser = { ...query, userId: user.uid };
    return this.notificationService.getNotifications(queryWithUser);
  }

  /**
   * Create a notification (admin only)
   */
  @Post()
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    return this.notificationService.createNotification(createNotificationDto);
  }

  /**
   * Create bulk notifications (admin only)
   */
  @Post('bulk')
  async createBulkNotification(
    @Body() bulkNotificationDto: BulkNotificationDto,
  ): Promise<Notification[]> {
    return this.notificationService.createBulkNotification(bulkNotificationDto);
  }

  /**
   * Send system announcement (admin only)
   */
  @Post('announcement')
  @HttpCode(HttpStatus.OK)
  async sendSystemAnnouncement(
    @Body() body: { title: string; message: string; userIds?: string[]; priority?: string },
  ): Promise<void> {
    await this.notificationService.sendSystemAnnouncement(
      body.title,
      body.message,
      body.userIds,
      body.priority as any,
    );
  }

  /**
   * Mark notification as read
   */
  @Put(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('id') notificationId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.notificationService.markNotificationAsRead(notificationId, user.uid);
  }

  /**
   * Mark all notifications as read
   */
  @Put('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: any): Promise<void> {
    await this.notificationService.markAllNotificationsAsRead(user.uid);
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('id') notificationId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.notificationService.deleteNotification(notificationId, user.uid);
  }

  /**
   * Get notification statistics
   */
  @Get('stats')
  async getNotificationStats(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<NotificationStatsDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.notificationService.getNotificationStats(user.uid, start, end);
  }

  /**
   * Get user notification preferences
   */
  @Get('preferences')
  async getPreferences(@CurrentUser() user: any): Promise<NotificationPreferences> {
    return this.preferencesService.getUserPreferences(user.uid);
  }

  /**
   * Update user notification preferences
   */
  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferencesService.updateUserPreferences(user.uid, updateDto);
  }

  /**
   * Reset notification preferences to defaults
   */
  @Post('preferences/reset')
  async resetPreferences(@CurrentUser() user: any): Promise<NotificationPreferences> {
    return this.preferencesService.resetUserPreferences(user.uid);
  }

  /**
   * Toggle specific notification type
   */
  @Put('preferences/toggle/:type')
  @HttpCode(HttpStatus.OK)
  async toggleNotificationType(
    @CurrentUser() user: any,
    @Param('type') notificationType: NotificationType,
    @Body() body: { enabled: boolean },
  ): Promise<void> {
    await this.preferencesService.toggleNotificationType(
      user.uid,
      notificationType,
      body.enabled,
    );
  }

  /**
   * Update quiet hours
   */
  @Put('preferences/quiet-hours')
  @HttpCode(HttpStatus.OK)
  async updateQuietHours(
    @CurrentUser() user: any,
    @Body() body: { start: string; end: string } | { quietHours: null },
  ): Promise<void> {
    const quietHours = 'quietHours' in body ? body.quietHours : { start: body.start, end: body.end };
    await this.preferencesService.updateQuietHours(user.uid, quietHours);
  }
}