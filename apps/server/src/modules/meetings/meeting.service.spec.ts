import { Test, TestingModule } from '@nestjs/testing';
import { MeetingService } from './meeting.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { 
  Meeting, 
  CreateMeetingDto, 
  UpdateMeetingDto, 
  MeetingStatus,
  UserRole 
} from '@home-management/types';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('MeetingService', () => {
  let service: MeetingService;
  let mockFirestore: any;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockMeeting: Meeting = {
    id: 'meeting-1',
    title: 'Monthly Board Meeting',
    description: 'Regular monthly meeting',
    scheduledDate: new Date('2024-02-15T10:00:00Z'),
    agenda: ['Budget review', 'Maintenance updates'],
    status: 'scheduled' as MeetingStatus,
    attendees: ['user-1', 'user-2'],
    createdBy: 'admin-1',
    createdAt: new Date('2024-02-01T10:00:00Z'),
    updatedAt: new Date('2024-02-01T10:00:00Z'),
  };

  const mockMeetingDocument = {
    id: 'meeting-1',
    title: 'Monthly Board Meeting',
    description: 'Regular monthly meeting',
    scheduledDate: { seconds: 1708084800, nanoseconds: 0 },
    agenda: ['Budget review', 'Maintenance updates'],
    status: 'scheduled',
    attendees: ['user-1', 'user-2'],
    createdBy: 'admin-1',
    createdAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
    updatedAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
  };

  beforeEach(async () => {
    // Mock Firestore
    const mockDoc = {
      id: 'meeting-1',
      exists: true,
      data: () => mockMeetingDocument,
    };

    const mockCollection = {
      doc: jest.fn().mockReturnValue({
        id: 'meeting-1',
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(mockDoc),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        forEach: jest.fn((callback) => {
          callback(mockDoc);
        }),
      }),
    };

    mockFirestore = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    // Mock NotificationService
    mockNotificationService = {
      sendMeetingNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingService,
        {
          provide: FirebaseConfigService,
          useValue: {
            getFirestore: () => mockFirestore,
          },
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMeeting', () => {
    it('should create a meeting successfully', async () => {
      const createMeetingDto: CreateMeetingDto = {
        title: 'New Meeting',
        description: 'Test meeting',
        scheduledDate: new Date('2024-03-15T10:00:00Z'),
        agenda: ['Item 1', 'Item 2'],
        attendees: ['user-1', 'user-2'],
      };

      const result = await service.createMeeting(createMeetingDto, 'admin-1');

      expect(result).toMatchObject({
        title: createMeetingDto.title,
        description: createMeetingDto.description,
        scheduledDate: createMeetingDto.scheduledDate,
        agenda: createMeetingDto.agenda,
        attendees: createMeetingDto.attendees,
        status: 'scheduled',
        createdBy: 'admin-1',
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('meetings');
      expect(mockNotificationService.sendMeetingNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Meeting' }),
        'meeting_scheduled',
        createMeetingDto.attendees
      );
    });
  });

  describe('getMeetingById', () => {
    it('should return a meeting when found', async () => {
      const result = await service.getMeetingById('meeting-1');

      expect(result).toMatchObject({
        id: 'meeting-1',
        title: 'Monthly Board Meeting',
        description: 'Regular monthly meeting',
      });
    });

    it('should throw NotFoundException when meeting not found', async () => {
      const mockDoc = {
        exists: false,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(service.getMeetingById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid document structure', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({ invalid: 'data' }),
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(service.getMeetingById('meeting-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMeeting', () => {
    it('should update meeting successfully when user is creator', async () => {
      const updateDto: UpdateMeetingDto = {
        title: 'Updated Meeting Title',
        notes: 'Meeting notes',
      };

      const result = await service.updateMeeting('meeting-1', updateDto, 'admin-1', UserRole.RESIDENT);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'meeting-1',
        title: 'Monthly Board Meeting',
      });
    });

    it('should update meeting successfully when user is admin', async () => {
      const updateDto: UpdateMeetingDto = {
        title: 'Updated Meeting Title',
      };

      const result = await service.updateMeeting('meeting-1', updateDto, 'other-user', UserRole.ADMIN);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'meeting-1',
      });
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      const updateDto: UpdateMeetingDto = {
        title: 'Updated Meeting Title',
      };

      await expect(
        service.updateMeeting('meeting-1', updateDto, 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should send notifications when status changes', async () => {
      const updateDto: UpdateMeetingDto = {
        status: 'cancelled' as MeetingStatus,
      };

      await service.updateMeeting('meeting-1', updateDto, 'admin-1', UserRole.ADMIN);

      expect(mockNotificationService.sendMeetingNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'meeting-1' }),
        'meeting_cancelled',
        expect.any(Array)
      );
    });
  });

  describe('deleteMeeting', () => {
    it('should delete meeting successfully when user is creator', async () => {
      await service.deleteMeeting('meeting-1', 'admin-1', UserRole.RESIDENT);

      expect(mockFirestore.collection().doc().delete).toHaveBeenCalled();
      expect(mockNotificationService.sendMeetingNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'meeting-1' }),
        'meeting_cancelled',
        expect.any(Array)
      );
    });

    it('should delete meeting successfully when user is admin', async () => {
      await service.deleteMeeting('meeting-1', 'other-user', UserRole.ADMIN);

      expect(mockFirestore.collection().doc().delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      await expect(
        service.deleteMeeting('meeting-1', 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-scheduled meetings', async () => {
      const completedMeetingDoc = {
        ...mockMeetingDocument,
        status: 'completed',
      };

      const mockDoc = {
        exists: true,
        data: () => completedMeetingDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(
        service.deleteMeeting('meeting-1', 'admin-1', UserRole.ADMIN)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMeetings', () => {
    it('should return meetings with filters', async () => {
      const queryDto = {
        status: 'scheduled' as MeetingStatus,
        createdBy: 'admin-1',
      };

      const result = await service.getMeetings(queryDto);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'meeting-1',
        title: 'Monthly Board Meeting',
      });

      expect(mockFirestore.collection().where).toHaveBeenCalledWith('status', '==', 'scheduled');
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('createdBy', '==', 'admin-1');
    });

    it('should return meetings with date range filters', async () => {
      const queryDto = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-28'),
      };

      const result = await service.getMeetings(queryDto);

      expect(result).toHaveLength(1);
      expect(mockFirestore.collection().where).toHaveBeenCalledWith(
        'scheduledDate',
        '>=',
        expect.any(Object)
      );
      expect(mockFirestore.collection().where).toHaveBeenCalledWith(
        'scheduledDate',
        '<=',
        expect.any(Object)
      );
    });
  });

  describe('publishNotes', () => {
    it('should publish notes successfully when user is creator', async () => {
      const notes = 'These are the meeting notes';

      const result = await service.publishNotes('meeting-1', notes, 'admin-1', UserRole.RESIDENT);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        notes,
        updatedAt: expect.any(Object),
      });

      expect(mockNotificationService.sendMeetingNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'meeting-1' }),
        'meeting_notes_published',
        expect.any(Array)
      );
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      await expect(
        service.publishNotes('meeting-1', 'notes', 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserMeetings', () => {
    it('should return meetings for a specific user', async () => {
      const result = await service.getUserMeetings('user-1');

      expect(result).toHaveLength(1);
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('attendees', 'array-contains', 'user-1');
    });
  });

  describe('getUpcomingMeetings', () => {
    it('should return upcoming meetings', async () => {
      const result = await service.getUpcomingMeetings();

      expect(result).toHaveLength(1);
      expect(mockFirestore.collection().where).toHaveBeenCalledWith(
        'scheduledDate',
        '>=',
        expect.any(Object)
      );
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('status', '==', 'scheduled');
    });

    it('should return upcoming meetings for specific user', async () => {
      const result = await service.getUpcomingMeetings('user-1');

      expect(result).toHaveLength(1);
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('attendees', 'array-contains', 'user-1');
    });
  });
});