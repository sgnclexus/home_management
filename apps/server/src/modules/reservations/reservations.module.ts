import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { FirebaseModule } from '../../config/firebase.module';
import { NotificationModule } from '../notifications/notification.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FirebaseModule, NotificationModule, UsersModule],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationsModule {}