import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationController } from './notification.controller';
import { FirebaseModule } from '../../config/firebase.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FirebaseModule, UsersModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationPreferencesService],
  exports: [NotificationService, NotificationPreferencesService],
})
export class NotificationModule {}