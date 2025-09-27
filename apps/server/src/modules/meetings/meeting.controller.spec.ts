import { Test, TestingModule } from '@nestjs/testing';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { VoteService } from './vote.service';
import { AgreementService } from './agreement.service';
import { 
  Meeting, 
  Vote, 
  Agreement,
  CreateMeetingDto, 
  UpdateMeetingDto,
  CreateVoteDto,
  CastVoteDto,
  CreateAgreementDto,
  UserRole,
  User
} from '@home-management/types';

describe('MeetingController', () => {
  let controller: MeetingController;
  let mockMeetingService: jest.Mocked<MeetingService>;
  let mockVoteService: jest.Mocked<VoteService>;
  let mockAgreementService: jest.Mocked<AgreementService>;

  const mockUser: User = {
    id: 'user-1',
    uid: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.ADMIN,
    preferredLanguage: 'en',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMeeting: Meeting = {
    id: 'meeting-1',
    title: 'Test Meeting',
    description: 'Test meeting description',
    scheduledDate: new Date('2024-02-15T10:00:00Z'),
    agenda: ['Item 1', 'Item 2'],
    status: 'scheduled',
    attendees: ['user-1', 'user-2'],
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVote: Vote = {
    id: 'vote-1',
    meetingId: 'meeting-1',
    question: 'Test vote question?',
    options: ['Yes', 'No'],
    votes: {},
    results: { 'Yes': 0, 'No': 0 },
    status: 'active',
    createdBy: 'user-1',
    isAnonymous: false,
    allowMultipleChoices: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAgreement: Agreement = {
    id: 'agreement-1',
    title: 'Test Agreement',
    description: 'Test agreement description',
    content: 'Agreement content',
    status: 'active',
    approvedBy: [],
    rejectedBy: [],
    comments: [],
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock services
    mockMeetingService = {
      createMeeting: jest.fn().mockResolvedValue(mockMeeting),
      getMeetings: jest.fn().mockResolvedValue([mockMeeting]),
      getMeetingById: jest.fn().mockResolvedValue(mockMeeting),
      updateMeeting: jest.fn().mockResolvedValue(mockMeeting),
      deleteMeeting: jest.fn().mockResolvedValue(undefined),
      publishNotes: jest.fn().mockResolvedValue(mockMeeting),
      startMeeting: jest.fn().mockResolvedValue(mockMeeting),
      completeMeeting: jest.fn().mockResolvedValue(mockMeeting),
      cancelMeeting: jest.fn().mockResolvedValue(mockMeeting),
      getUserMeetings: jest.fn().mockResolvedValue([mockMeeting]),
      getUpcomingMeetings: jest.fn().mockResolvedValue([mockMeeting]),
    } as any;

    mockVoteService = {
      createVote: jest.fn().mockResolvedValue(mockVote),
      getVoteById: jest.fn().mockResolvedValue(mockVote),
      getVotesByMeeting: jest.fn().mockResolvedValue([mockVote]),
      castVote: jest.fn().mockResolvedValue(mockVote),
      closeVote: jest.fn().mockResolvedValue(mockVote),
      cancelVote: jest.fn().mockResolvedValue(mockVote),
      getUserVoteStatus: jest.fn().mockResolvedValue({ hasVoted: false }),
      getVoteResults: jest.fn().mockResolvedValue({
        vote: mockVote,
        totalVotes: 0,
        participationRate: 0,
      }),
    } as any;

    mockAgreementService = {
      createAgreement: jest.fn().mockResolvedValue(mockAgreement),
      getAgreements: jest.fn().mockResolvedValue([mockAgreement]),
      getActiveAgreements: jest.fn().mockResolvedValue([mockAgreement]),
      getAgreementById: jest.fn().mockResolvedValue(mockAgreement),
      updateAgreement: jest.fn().mockResolvedValue(mockAgreement),
      deleteAgreement: jest.fn().mockResolvedValue(undefined),
      approveAgreement: jest.fn().mockResolvedValue(mockAgreement),
      rejectAgreement: jest.fn().mockResolvedValue(mockAgreement),
      activateAgreement: jest.fn().mockResolvedValue(mockAgreement),
      expireAgreement: jest.fn().mockResolvedValue(mockAgreement),
      cancelAgreement: jest.fn().mockResolvedValue(mockAgreement),
      addComment: jest.fn().mockResolvedValue({
        id: 'comment-1',
        agreementId: 'agreement-1',
        userId: 'user-1',
        content: 'Test comment',
        replies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getAgreementComments: jest.fn().mockResolvedValue([]),
      deleteComment: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetingController],
      providers: [
        {
          provide: MeetingService,
          useValue: mockMeetingService,
        },
        {
          provide: VoteService,
          useValue: mockVoteService,
        },
        {
          provide: AgreementService,
          useValue: mockAgreementService,
        },
      ],
    }).compile();

    controller = module.get<MeetingController>(MeetingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Meeting endpoints', () => {
    describe('createMeeting', () => {
      it('should create a meeting', async () => {
        const createMeetingDto: CreateMeetingDto = {
          title: 'New Meeting',
          description: 'Test meeting',
          scheduledDate: new Date('2024-03-15T10:00:00Z'),
          agenda: ['Item 1'],
          attendees: ['user-1', 'user-2'],
        };

        const result = await controller.createMeeting(createMeetingDto, mockUser);

        expect(result).toEqual(mockMeeting);
        expect(mockMeetingService.createMeeting).toHaveBeenCalledWith(createMeetingDto, mockUser.uid);
      });
    });

    describe('getMeetings', () => {
      it('should return meetings with query parameters', async () => {
        const queryDto = { status: 'scheduled' as any };

        const result = await controller.getMeetings(queryDto);

        expect(result).toEqual([mockMeeting]);
        expect(mockMeetingService.getMeetings).toHaveBeenCalledWith(queryDto);
      });
    });

    describe('getMeetingById', () => {
      it('should return a meeting by id', async () => {
        const result = await controller.getMeetingById('meeting-1');

        expect(result).toEqual(mockMeeting);
        expect(mockMeetingService.getMeetingById).toHaveBeenCalledWith('meeting-1');
      });
    });

    describe('updateMeeting', () => {
      it('should update a meeting', async () => {
        const updateMeetingDto: UpdateMeetingDto = {
          title: 'Updated Meeting',
        };

        const result = await controller.updateMeeting('meeting-1', updateMeetingDto, mockUser);

        expect(result).toEqual(mockMeeting);
        expect(mockMeetingService.updateMeeting).toHaveBeenCalledWith(
          'meeting-1',
          updateMeetingDto,
          mockUser.uid,
          mockUser.role
        );
      });
    });

    describe('deleteMeeting', () => {
      it('should delete a meeting', async () => {
        await controller.deleteMeeting('meeting-1', mockUser);

        expect(mockMeetingService.deleteMeeting).toHaveBeenCalledWith(
          'meeting-1',
          mockUser.uid,
          mockUser.role
        );
      });
    });

    describe('publishNotes', () => {
      it('should publish meeting notes', async () => {
        const notes = 'Meeting notes content';

        const result = await controller.publishNotes('meeting-1', notes, mockUser);

        expect(result).toEqual(mockMeeting);
        expect(mockMeetingService.publishNotes).toHaveBeenCalledWith(
          'meeting-1',
          notes,
          mockUser.uid,
          mockUser.role
        );
      });
    });

    describe('getUserMeetings', () => {
      it('should return user meetings', async () => {
        const result = await controller.getUserMeetings(mockUser);

        expect(result).toEqual([mockMeeting]);
        expect(mockMeetingService.getUserMeetings).toHaveBeenCalledWith(mockUser.uid);
      });
    });

    describe('getUpcomingMeetings', () => {
      it('should return upcoming meetings', async () => {
        const result = await controller.getUpcomingMeetings(mockUser);

        expect(result).toEqual([mockMeeting]);
        expect(mockMeetingService.getUpcomingMeetings).toHaveBeenCalledWith(mockUser.uid);
      });
    });
  });

  describe('Vote endpoints', () => {
    describe('createVote', () => {
      it('should create a vote', async () => {
        const createVoteDto: CreateVoteDto = {
          meetingId: 'meeting-1',
          question: 'Vote question?',
          options: ['Yes', 'No'],
        };

        const result = await controller.createVote('meeting-1', createVoteDto, mockUser);

        expect(result).toEqual(mockVote);
        expect(mockVoteService.createVote).toHaveBeenCalledWith(createVoteDto, mockUser.uid);
      });
    });

    describe('getMeetingVotes', () => {
      it('should return votes for a meeting', async () => {
        const result = await controller.getMeetingVotes('meeting-1');

        expect(result).toEqual([mockVote]);
        expect(mockVoteService.getVotesByMeeting).toHaveBeenCalledWith('meeting-1');
      });
    });

    describe('castVote', () => {
      it('should cast a vote', async () => {
        const castVoteDto = { selectedOptions: ['Yes'] };

        const result = await controller.castVote('vote-1', castVoteDto, mockUser);

        expect(result).toEqual(mockVote);
        expect(mockVoteService.castVote).toHaveBeenCalledWith(
          { ...castVoteDto, voteId: 'vote-1' },
          mockUser.uid
        );
      });
    });

    describe('closeVote', () => {
      it('should close a vote', async () => {
        const result = await controller.closeVote('vote-1', mockUser);

        expect(result).toEqual(mockVote);
        expect(mockVoteService.closeVote).toHaveBeenCalledWith('vote-1', mockUser.uid, mockUser.role);
      });
    });

    describe('getVoteById', () => {
      it('should return a vote by id', async () => {
        const result = await controller.getVoteById('vote-1');

        expect(result).toEqual(mockVote);
        expect(mockVoteService.getVoteById).toHaveBeenCalledWith('vote-1');
      });
    });

    describe('getUserVoteStatus', () => {
      it('should return user vote status', async () => {
        const result = await controller.getUserVoteStatus('vote-1', mockUser);

        expect(result).toEqual({ hasVoted: false });
        expect(mockVoteService.getUserVoteStatus).toHaveBeenCalledWith('vote-1', mockUser.uid);
      });
    });

    describe('getVoteResults', () => {
      it('should return vote results', async () => {
        const expectedResults = {
          vote: mockVote,
          totalVotes: 0,
          participationRate: 0,
        };

        const result = await controller.getVoteResults('vote-1', mockUser);

        expect(result).toEqual(expectedResults);
        expect(mockVoteService.getVoteResults).toHaveBeenCalledWith('vote-1', mockUser.uid);
      });
    });
  });

  describe('Agreement endpoints', () => {
    describe('createAgreement', () => {
      it('should create an agreement', async () => {
        const createAgreementDto: CreateAgreementDto = {
          title: 'New Agreement',
          description: 'Test agreement',
          content: 'Agreement content',
        };

        const result = await controller.createAgreement(createAgreementDto, mockUser);

        expect(result).toEqual(mockAgreement);
        expect(mockAgreementService.createAgreement).toHaveBeenCalledWith(createAgreementDto, mockUser.uid);
      });
    });

    describe('getAgreements', () => {
      it('should return agreements', async () => {
        const queryDto = { status: 'active' };

        const result = await controller.getAgreements(queryDto);

        expect(result).toEqual([mockAgreement]);
        expect(mockAgreementService.getAgreements).toHaveBeenCalledWith(queryDto);
      });
    });

    describe('getActiveAgreements', () => {
      it('should return active agreements', async () => {
        const result = await controller.getActiveAgreements();

        expect(result).toEqual([mockAgreement]);
        expect(mockAgreementService.getActiveAgreements).toHaveBeenCalled();
      });
    });

    describe('getAgreementById', () => {
      it('should return an agreement by id', async () => {
        const result = await controller.getAgreementById('agreement-1');

        expect(result).toEqual(mockAgreement);
        expect(mockAgreementService.getAgreementById).toHaveBeenCalledWith('agreement-1');
      });
    });

    describe('approveAgreement', () => {
      it('should approve an agreement', async () => {
        const result = await controller.approveAgreement('agreement-1', mockUser);

        expect(result).toEqual(mockAgreement);
        expect(mockAgreementService.approveAgreement).toHaveBeenCalledWith('agreement-1', mockUser.uid);
      });
    });

    describe('rejectAgreement', () => {
      it('should reject an agreement', async () => {
        const result = await controller.rejectAgreement('agreement-1', mockUser);

        expect(result).toEqual(mockAgreement);
        expect(mockAgreementService.rejectAgreement).toHaveBeenCalledWith('agreement-1', mockUser.uid);
      });
    });

    describe('addAgreementComment', () => {
      it('should add a comment to an agreement', async () => {
        const createCommentDto = { content: 'Test comment' };
        const expectedComment = {
          id: 'comment-1',
          agreementId: 'agreement-1',
          userId: 'user-1',
          content: 'Test comment',
          replies: [],
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        };

        const result = await controller.addAgreementComment('agreement-1', createCommentDto, mockUser);

        expect(result).toEqual(expectedComment);
        expect(mockAgreementService.addComment).toHaveBeenCalledWith(
          { ...createCommentDto, agreementId: 'agreement-1' },
          mockUser.uid
        );
      });
    });

    describe('getAgreementComments', () => {
      it('should return agreement comments', async () => {
        const result = await controller.getAgreementComments('agreement-1');

        expect(result).toEqual([]);
        expect(mockAgreementService.getAgreementComments).toHaveBeenCalledWith('agreement-1');
      });
    });

    describe('deleteAgreementComment', () => {
      it('should delete an agreement comment', async () => {
        await controller.deleteAgreementComment('comment-1', mockUser);

        expect(mockAgreementService.deleteComment).toHaveBeenCalledWith(
          'comment-1',
          mockUser.uid,
          mockUser.role
        );
      });
    });
  });
});