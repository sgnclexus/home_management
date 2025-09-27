import { Module } from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { MeetingController } from './meeting.controller';
import { VoteService } from './vote.service';
import { AgreementService } from './agreement.service';
import { FirebaseModule } from '../../config/firebase.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [FirebaseModule, NotificationModule],
  controllers: [MeetingController],
  providers: [MeetingService, VoteService, AgreementService],
  exports: [MeetingService, VoteService, AgreementService],
})
export class MeetingsModule {}