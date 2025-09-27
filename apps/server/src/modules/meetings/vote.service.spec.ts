import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { MeetingService } from './meeting.service';
import { NotificationService } from '../notifications/notification.service';
import { 
  Vote, 
  Meeting,
  CreateVoteDto, 
  CastVoteDto, 
  VoteStatus,
  UserRole 
} from '@home-management/types';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('VoteService', () => {
  let service: VoteService;
  let mockFirestore: any;
  let mockMeetingService: jest.Mocked<MeetingService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockMeeting: Meeting = {
    id: 'meeting-1',
    title: 'Test Meeting',
    description: 'Test meeting',
    scheduledDate: new Date('2024-02-15T10:00:00Z'),
    agenda: ['Item 1'],
    status: 'scheduled',
    attendees: ['user-1', 'user-2', 'user-3'],
    createdBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVote: Vote = {
    id: 'vote-1',
    meetingId: 'meeting-1',
    question: 'Should we approve the budget?',
    options: ['Yes', 'No', 'Abstain'],
    votes: { 'user-1': 'Yes' },
    results: { 'Yes': 1, 'No': 0, 'Abstain': 0 },
    status: 'active' as VoteStatus,
    createdBy: 'admin-1',
    isAnonymous: false,
    allowMultipleChoices: false,
    createdAt: new Date('2024-02-01T10:00:00Z'),
    updatedAt: new Date('2024-02-01T10:00:00Z'),
  };

  const mockVoteDocument = {
    id: 'vote-1',
    meetingId: 'meeting-1',
    question: 'Should we approve the budget?',
    options: ['Yes', 'No', 'Abstain'],
    votes: { 'user-1': 'Yes' },
    results: { 'Yes': 1, 'No': 0, 'Abstain': 0 },
    status: 'active',
    createdBy: 'admin-1',
    isAnonymous: false,
    allowMultipleChoices: false,
    createdAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
    updatedAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
  };

  beforeEach(async () => {
    // Mock Firestore
    const mockDoc = {
      id: 'vote-1',
      exists: true,
      data: () => mockVoteDocument,
    };

    const mockCollection = {
      doc: jest.fn().mockReturnValue({
        id: 'vote-1',
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(mockDoc),
        update: jest.fn().mockResolvedValue(undefined),
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

    // Mock MeetingService
    mockMeetingService = {
      getMeetingById: jest.fn().mockResolvedValue(mockMeeting),
    } as any;

    // Mock NotificationService
    mockNotificationService = {
      sendVoteNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: 'Firestore',
          useValue: mockFirestore,
        },
        {
          provide: MeetingService,
          useValue: mockMeetingService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createVote', () => {
    it('should create a vote successfully', async () => {
      const createVoteDto: CreateVoteDto = {
        meetingId: 'meeting-1',
        question: 'New vote question?',
        options: ['Option A', 'Option B'],
        isAnonymous: false,
        allowMultipleChoices: false,
      };

      const result = await service.createVote(createVoteDto, 'admin-1');

      expect(result).toMatchObject({
        meetingId: createVoteDto.meetingId,
        question: createVoteDto.question,
        options: createVoteDto.options,
        status: 'active',
        createdBy: 'admin-1',
        votes: {},
        results: { 'Option A': 0, 'Option B': 0 },
      });

      expect(mockMeetingService.getMeetingById).toHaveBeenCalledWith('meeting-1');
      expect(mockFirestore.collection).toHaveBeenCalledWith('votes');
      expect(mockNotificationService.sendVoteNotification).toHaveBeenCalledWith(
        expect.objectContaining({ question: 'New vote question?' }),
        mockMeeting,
        'vote_created',
        mockMeeting.attendees
      );
    });
  });

  describe('getVoteById', () => {
    it('should return a vote when found', async () => {
      const result = await service.getVoteById('vote-1');

      expect(result).toMatchObject({
        id: 'vote-1',
        question: 'Should we approve the budget?',
        options: ['Yes', 'No', 'Abstain'],
      });
    });

    it('should throw NotFoundException when vote not found', async () => {
      const mockDoc = {
        exists: false,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(service.getVoteById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('castVote', () => {
    it('should cast vote successfully for authorized user', async () => {
      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Yes'],
      };

      const result = await service.castVote(castVoteDto, 'user-2');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        votes: expect.objectContaining({
          'user-1': 'Yes',
          'user-2': 'Yes',
        }),
        results: expect.objectContaining({
          'Yes': 2,
          'No': 0,
          'Abstain': 0,
        }),
        updatedAt: expect.any(Object),
      });
    });

    it('should update existing vote', async () => {
      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['No'],
      };

      const result = await service.castVote(castVoteDto, 'user-1');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        votes: expect.objectContaining({
          'user-1': 'No',
        }),
        results: expect.objectContaining({
          'Yes': 0,
          'No': 1,
          'Abstain': 0,
        }),
        updatedAt: expect.any(Object),
      });
    });

    it('should throw BadRequestException for inactive vote', async () => {
      const inactiveVoteDoc = {
        ...mockVoteDocument,
        status: 'closed',
      };

      const mockDoc = {
        exists: true,
        data: () => inactiveVoteDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Yes'],
      };

      await expect(service.castVote(castVoteDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Yes'],
      };

      await expect(service.castVote(castVoteDto, 'unauthorized-user')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid options', async () => {
      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Invalid Option'],
      };

      await expect(service.castVote(castVoteDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for multiple choices when not allowed', async () => {
      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Yes', 'No'],
      };

      await expect(service.castVote(castVoteDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should handle multiple choice votes', async () => {
      const multiChoiceVoteDoc = {
        ...mockVoteDocument,
        allowMultipleChoices: true,
        votes: {},
        results: { 'Yes': 0, 'No': 0, 'Abstain': 0 },
      };

      const mockDoc = {
        exists: true,
        data: () => multiChoiceVoteDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      const castVoteDto: CastVoteDto = {
        voteId: 'vote-1',
        selectedOptions: ['Yes', 'Abstain'],
      };

      await service.castVote(castVoteDto, 'user-1');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        votes: expect.objectContaining({
          'user-1': 'Yes,Abstain',
        }),
        results: expect.objectContaining({
          'Yes': 1,
          'No': 0,
          'Abstain': 1,
        }),
        updatedAt: expect.any(Object),
      });
    });
  });

  describe('closeVote', () => {
    it('should close vote successfully when user is creator', async () => {
      const result = await service.closeVote('vote-1', 'admin-1', UserRole.RESIDENT);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        status: 'closed',
        closedAt: expect.any(Object),
        updatedAt: expect.any(Object),
      });

      expect(mockNotificationService.sendVoteNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'vote-1' }),
        mockMeeting,
        'vote_closed',
        mockMeeting.attendees
      );
    });

    it('should close vote successfully when user is admin', async () => {
      await service.closeVote('vote-1', 'other-user', UserRole.ADMIN);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      await expect(
        service.closeVote('vote-1', 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for inactive vote', async () => {
      const closedVoteDoc = {
        ...mockVoteDocument,
        status: 'closed',
      };

      const mockDoc = {
        exists: true,
        data: () => closedVoteDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(
        service.closeVote('vote-1', 'admin-1', UserRole.ADMIN)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVotes', () => {
    it('should return votes with filters', async () => {
      const queryDto = {
        meetingId: 'meeting-1',
        status: 'active' as VoteStatus,
      };

      const result = await service.getVotes(queryDto);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'vote-1',
        question: 'Should we approve the budget?',
      });

      expect(mockFirestore.collection().where).toHaveBeenCalledWith('meetingId', '==', 'meeting-1');
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('status', '==', 'active');
    });
  });

  describe('getUserVoteStatus', () => {
    it('should return vote status for user who voted', async () => {
      const result = await service.getUserVoteStatus('vote-1', 'user-1');

      expect(result).toEqual({
        hasVoted: true,
        selectedOptions: ['Yes'],
      });
    });

    it('should return vote status for user who has not voted', async () => {
      const result = await service.getUserVoteStatus('vote-1', 'user-2');

      expect(result).toEqual({
        hasVoted: false,
      });
    });

    it('should handle multiple choice votes', async () => {
      const multiChoiceVoteDoc = {
        ...mockVoteDocument,
        allowMultipleChoices: true,
        votes: { 'user-1': 'Yes,Abstain' },
      };

      const mockDoc = {
        exists: true,
        data: () => multiChoiceVoteDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      const result = await service.getUserVoteStatus('vote-1', 'user-1');

      expect(result).toEqual({
        hasVoted: true,
        selectedOptions: ['Yes', 'Abstain'],
      });
    });
  });

  describe('getVoteResults', () => {
    it('should return vote results for authorized user', async () => {
      const result = await service.getVoteResults('vote-1', 'user-1');

      expect(result).toEqual({
        vote: expect.objectContaining({
          id: 'vote-1',
          question: 'Should we approve the budget?',
        }),
        totalVotes: 1,
        participationRate: 33.33333333333333, // 1 vote out of 3 attendees
      });
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      await expect(
        service.getVoteResults('vote-1', 'unauthorized-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });
});