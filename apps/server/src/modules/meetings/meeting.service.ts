import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Meeting, 
  CreateMeetingDto, 
  UpdateMeetingDto, 
  MeetingQueryDto,
  MeetingStatus,
  UserRole
} from '@home-management/types';
import { 
  FIRESTORE_COLLECTIONS, 
  meetingToFirestoreDocument, 
  firestoreDocumentToMeeting,
  validateMeetingDocument,
  MEETING_FIELD_PATHS
} from '@home-management/utils';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseConfigService } from '../../config/firebase.config';

@Injectable()
export class MeetingService {
  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async createMeeting(createMeetingDto: CreateMeetingDto, createdBy: string): Promise<Meeting> {
    const firestore = this.firebaseConfig.getFirestore();
    const meetingId = firestore.collection(FIRESTORE_COLLECTIONS.MEETINGS).doc().id;
    
    const meeting: Meeting = {
      id: meetingId,
      ...createMeetingDto,
      status: 'scheduled' as MeetingStatus,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const meetingDoc = meetingToFirestoreDocument(meeting);
    
    await firestore
      .collection(FIRESTORE_COLLECTIONS.MEETINGS)
      .doc(meetingId)
      .set({
        ...meetingDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    // Send notifications to attendees
    await this.notificationService.sendMeetingNotification(
      meeting,
      'meeting_scheduled',
      createMeetingDto.attendees
    );

    return meeting;
  }

  async getMeetingById(meetingId: string): Promise<Meeting> {
    const firestore = this.firebaseConfig.getFirestore();
    const doc = await firestore
      .collection(FIRESTORE_COLLECTIONS.MEETINGS)
      .doc(meetingId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const data = doc.data();
    if (!validateMeetingDocument(data)) {
      throw new BadRequestException('Invalid meeting document structure');
    }

    return firestoreDocumentToMeeting(data);
  }

  async updateMeeting(
    meetingId: string, 
    updateMeetingDto: UpdateMeetingDto, 
    userId: string,
    userRole: UserRole
  ): Promise<Meeting> {
    const meeting = await this.getMeetingById(meetingId);
    
    // Check permissions - only creator or admin can update
    if (meeting.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update this meeting');
    }

    const updateData = {
      ...updateMeetingDto,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Convert dates to Firestore timestamps if provided
    if (updateMeetingDto.scheduledDate) {
      (updateData as any).scheduledDate = {
        seconds: Math.floor(updateMeetingDto.scheduledDate.getTime() / 1000),
        nanoseconds: 0,
      };
    }

    const firestore = this.firebaseConfig.getFirestore();
    await firestore
      .collection(FIRESTORE_COLLECTIONS.MEETINGS)
      .doc(meetingId)
      .update(updateData);

    const updatedMeeting = await this.getMeetingById(meetingId);

    // Send notifications if status changed or meeting was rescheduled
    if (updateMeetingDto.status || updateMeetingDto.scheduledDate) {
      const notificationType = updateMeetingDto.status === 'cancelled' 
        ? 'meeting_cancelled' 
        : updateMeetingDto.scheduledDate 
        ? 'meeting_rescheduled' 
        : 'meeting_updated';
      
      await this.notificationService.sendMeetingNotification(
        updatedMeeting,
        notificationType,
        updatedMeeting.attendees
      );
    }

    return updatedMeeting;
  }

  async deleteMeeting(meetingId: string, userId: string, userRole: UserRole): Promise<void> {
    const meeting = await this.getMeetingById(meetingId);
    
    // Check permissions - only creator or admin can delete
    if (meeting.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete this meeting');
    }

    // Check if meeting can be deleted (only scheduled meetings)
    if (meeting.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled meetings can be deleted');
    }

    const firestore = this.firebaseConfig.getFirestore();
    await firestore
      .collection(FIRESTORE_COLLECTIONS.MEETINGS)
      .doc(meetingId)
      .delete();

    // Send cancellation notifications
    await this.notificationService.sendMeetingNotification(
      meeting,
      'meeting_cancelled',
      meeting.attendees
    );
  }

  async getMeetings(queryDto: MeetingQueryDto): Promise<Meeting[]> {
    const firestore = this.firebaseConfig.getFirestore();
    let query: any = firestore.collection(FIRESTORE_COLLECTIONS.MEETINGS);

    // Apply filters
    if (queryDto.status) {
      query = query.where(MEETING_FIELD_PATHS.STATUS, '==', queryDto.status);
    }

    if (queryDto.createdBy) {
      query = query.where(MEETING_FIELD_PATHS.CREATED_BY, '==', queryDto.createdBy);
    }

    if (queryDto.attendeeId) {
      query = query.where(MEETING_FIELD_PATHS.ATTENDEES, 'array-contains', queryDto.attendeeId);
    }

    if (queryDto.startDate) {
      const startTimestamp = {
        seconds: Math.floor(queryDto.startDate.getTime() / 1000),
        nanoseconds: 0,
      };
      query = query.where(MEETING_FIELD_PATHS.SCHEDULED_DATE, '>=', startTimestamp);
    }

    if (queryDto.endDate) {
      const endTimestamp = {
        seconds: Math.floor(queryDto.endDate.getTime() / 1000),
        nanoseconds: 0,
      };
      query = query.where(MEETING_FIELD_PATHS.SCHEDULED_DATE, '<=', endTimestamp);
    }

    // Order by scheduled date
    query = query.orderBy(MEETING_FIELD_PATHS.SCHEDULED_DATE, 'desc');

    const snapshot = await query.get();
    const meetings: Meeting[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (validateMeetingDocument(data)) {
        meetings.push(firestoreDocumentToMeeting(data));
      }
    });

    return meetings;
  }

  async getMeetingsByDateRange(startDate: Date, endDate: Date): Promise<Meeting[]> {
    return this.getMeetings({ startDate, endDate });
  }

  async publishNotes(meetingId: string, notes: string, userId: string, userRole: UserRole): Promise<Meeting> {
    const meeting = await this.getMeetingById(meetingId);
    
    // Check permissions - only creator or admin can publish notes
    if (meeting.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to publish notes for this meeting');
    }

    const firestore = this.firebaseConfig.getFirestore();
    await firestore
      .collection(FIRESTORE_COLLECTIONS.MEETINGS)
      .doc(meetingId)
      .update({
        notes,
        updatedAt: FieldValue.serverTimestamp(),
      });

    const updatedMeeting = await this.getMeetingById(meetingId);

    // Send notifications about published notes
    await this.notificationService.sendMeetingNotification(
      updatedMeeting,
      'meeting_notes_published',
      updatedMeeting.attendees
    );

    return updatedMeeting;
  }

  async startMeeting(meetingId: string, userId: string, userRole: UserRole): Promise<Meeting> {
    return this.updateMeeting(
      meetingId, 
      { status: 'in_progress' as MeetingStatus }, 
      userId, 
      userRole
    );
  }

  async completeMeeting(meetingId: string, userId: string, userRole: UserRole): Promise<Meeting> {
    return this.updateMeeting(
      meetingId, 
      { status: 'completed' as MeetingStatus }, 
      userId, 
      userRole
    );
  }

  async cancelMeeting(meetingId: string, userId: string, userRole: UserRole): Promise<Meeting> {
    return this.updateMeeting(
      meetingId, 
      { status: 'cancelled' as MeetingStatus }, 
      userId, 
      userRole
    );
  }

  async getUserMeetings(userId: string): Promise<Meeting[]> {
    return this.getMeetings({ attendeeId: userId });
  }

  async getUpcomingMeetings(userId?: string): Promise<Meeting[]> {
    const now = new Date();
    const queryDto: MeetingQueryDto = {
      startDate: now,
      status: 'scheduled',
    };

    if (userId) {
      queryDto.attendeeId = userId;
    }

    return this.getMeetings(queryDto);
  }
}