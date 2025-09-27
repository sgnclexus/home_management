import { Test, TestingModule } from '@nestjs/testing';
import { AgreementService } from './agreement.service';
import { MeetingService } from './meeting.service';
import { VoteService } from './vote.service';
import { NotificationService } from '../notifications/notification.service';
import { 
  Agreement, 
  AgreementComment,
  CreateAgreementDto, 
  UpdateAgreementDto,
  CreateAgreementCommentDto,
  AgreementStatus,
  UserRole 
} from '@home-management/types';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AgreementService', () => {
  let service: AgreementService;
  let mockFirestore: any;
  let mockMeetingService: jest.Mocked<MeetingService>;
  let mockVoteService: jest.Mocked<VoteService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  const mockAgreement: Agreement = {
    id: 'agreement-1',
    title: 'Community Pool Rules',
    description: 'Updated rules for pool usage',
    content: 'Pool hours are 6 AM to 10 PM...',
    status: 'active' as AgreementStatus,
    approvedBy: ['user-1'],
    rejectedBy: [],
    comments: [],
    createdBy: 'admin-1',
    createdAt: new Date('2024-02-01T10:00:00Z'),
    updatedAt: new Date('2024-02-01T10:00:00Z'),
  };

  const mockAgreementDocument = {
    id: 'agreement-1',
    title: 'Community Pool Rules',
    description: 'Updated rules for pool usage',
    content: 'Pool hours are 6 AM to 10 PM...',
    status: 'active',
    approvedBy: ['user-1'],
    rejectedBy: [],
    createdBy: 'admin-1',
    createdAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
    updatedAt: { toDate: () => new Date('2024-02-01T10:00:00Z') },
  };

  const mockComment: AgreementComment = {
    id: 'comment-1',
    agreementId: 'agreement-1',
    userId: 'user-1',
    content: 'I agree with these rules',
    replies: [],
    createdAt: new Date('2024-02-02T10:00:00Z'),
    updatedAt: new Date('2024-02-02T10:00:00Z'),
  };

  const mockCommentDocument = {
    id: 'comment-1',
    agreementId: 'agreement-1',
    userId: 'user-1',
    content: 'I agree with these rules',
    createdAt: { toDate: () => new Date('2024-02-02T10:00:00Z') },
    updatedAt: { toDate: () => new Date('2024-02-02T10:00:00Z') },
  };

  beforeEach(async () => {
    // Mock Firestore
    const mockAgreementDoc = {
      id: 'agreement-1',
      exists: true,
      data: () => mockAgreementDocument,
    };

    const mockCommentDoc = {
      id: 'comment-1',
      exists: true,
      data: () => mockCommentDocument,
    };

    const mockCollection = {
      doc: jest.fn().mockReturnValue({
        id: 'agreement-1',
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(mockAgreementDoc),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: [mockCommentDoc],
        forEach: jest.fn((callback) => {
          callback(mockAgreementDoc);
        }),
      }),
    };

    const mockBatch = {
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };

    mockFirestore = {
      collection: jest.fn().mockReturnValue(mockCollection),
      batch: jest.fn().mockReturnValue(mockBatch),
    };

    // Mock services
    mockMeetingService = {
      getMeetingById: jest.fn().mockResolvedValue({ id: 'meeting-1' }),
    } as any;

    mockVoteService = {
      getVoteById: jest.fn().mockResolvedValue({ id: 'vote-1' }),
    } as any;

    mockNotificationService = {
      sendAgreementNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreementService,
        {
          provide: 'Firestore',
          useValue: mockFirestore,
        },
        {
          provide: MeetingService,
          useValue: mockMeetingService,
        },
        {
          provide: VoteService,
          useValue: mockVoteService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<AgreementService>(AgreementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAgreement', () => {
    it('should create an agreement successfully', async () => {
      const createAgreementDto: CreateAgreementDto = {
        title: 'New Agreement',
        description: 'Test agreement',
        content: 'Agreement content...',
        meetingId: 'meeting-1',
      };

      const result = await service.createAgreement(createAgreementDto, 'admin-1');

      expect(result).toMatchObject({
        title: createAgreementDto.title,
        description: createAgreementDto.description,
        content: createAgreementDto.content,
        status: 'draft',
        createdBy: 'admin-1',
        approvedBy: [],
        rejectedBy: [],
      });

      expect(mockMeetingService.getMeetingById).toHaveBeenCalledWith('meeting-1');
      expect(mockFirestore.collection).toHaveBeenCalledWith('agreements');
    });

    it('should create agreement with vote reference', async () => {
      const createAgreementDto: CreateAgreementDto = {
        title: 'New Agreement',
        description: 'Test agreement',
        content: 'Agreement content...',
        voteId: 'vote-1',
      };

      const result = await service.createAgreement(createAgreementDto, 'admin-1');

      expect(mockVoteService.getVoteById).toHaveBeenCalledWith('vote-1');
      expect(result.voteId).toBe('vote-1');
    });
  });

  describe('getAgreementById', () => {
    it('should return an agreement with comments', async () => {
      const result = await service.getAgreementById('agreement-1');

      expect(result).toMatchObject({
        id: 'agreement-1',
        title: 'Community Pool Rules',
        description: 'Updated rules for pool usage',
      });
      expect(result.comments).toBeDefined();
    });

    it('should throw NotFoundException when agreement not found', async () => {
      const mockDoc = {
        exists: false,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(service.getAgreementById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAgreement', () => {
    it('should update agreement successfully when user is creator', async () => {
      const updateDto: UpdateAgreementDto = {
        title: 'Updated Agreement Title',
        status: 'active' as AgreementStatus,
      };

      const result = await service.updateAgreement('agreement-1', updateDto, 'admin-1', UserRole.RESIDENT);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
      expect(mockNotificationService.sendAgreementNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agreement-1' }),
        'agreement_activated'
      );
    });

    it('should update agreement successfully when user is admin', async () => {
      const updateDto: UpdateAgreementDto = {
        title: 'Updated Agreement Title',
      };

      await service.updateAgreement('agreement-1', updateDto, 'other-user', UserRole.ADMIN);

      expect(mockFirestore.collection().doc().update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      const updateDto: UpdateAgreementDto = {
        title: 'Updated Agreement Title',
      };

      await expect(
        service.updateAgreement('agreement-1', updateDto, 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAgreement', () => {
    it('should delete draft agreement successfully', async () => {
      const draftAgreementDoc = {
        ...mockAgreementDocument,
        status: 'draft',
      };

      const mockDoc = {
        exists: true,
        data: () => draftAgreementDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await service.deleteAgreement('agreement-1', 'admin-1', UserRole.ADMIN);

      expect(mockFirestore.batch().commit).toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-draft agreements', async () => {
      await expect(
        service.deleteAgreement('agreement-1', 'admin-1', UserRole.ADMIN)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      await expect(
        service.deleteAgreement('agreement-1', 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approveAgreement', () => {
    it('should approve agreement successfully', async () => {
      const result = await service.approveAgreement('agreement-1', 'user-2');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        approvedBy: ['user-1', 'user-2'],
        rejectedBy: [],
        updatedAt: expect.any(Object),
      });
    });

    it('should move user from rejected to approved', async () => {
      const rejectedAgreementDoc = {
        ...mockAgreementDocument,
        approvedBy: [],
        rejectedBy: ['user-2'],
      };

      const mockDoc = {
        exists: true,
        data: () => rejectedAgreementDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await service.approveAgreement('agreement-1', 'user-2');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        approvedBy: ['user-2'],
        rejectedBy: [],
        updatedAt: expect.any(Object),
      });
    });

    it('should throw BadRequestException for non-active agreements', async () => {
      const draftAgreementDoc = {
        ...mockAgreementDocument,
        status: 'draft',
      };

      const mockDoc = {
        exists: true,
        data: () => draftAgreementDoc,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockDoc);

      await expect(
        service.approveAgreement('agreement-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectAgreement', () => {
    it('should reject agreement successfully', async () => {
      const result = await service.rejectAgreement('agreement-1', 'user-2');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        approvedBy: ['user-1'],
        rejectedBy: ['user-2'],
        updatedAt: expect.any(Object),
      });
    });

    it('should move user from approved to rejected', async () => {
      await service.rejectAgreement('agreement-1', 'user-1');

      expect(mockFirestore.collection().doc().update).toHaveBeenCalledWith({
        approvedBy: [],
        rejectedBy: ['user-1'],
        updatedAt: expect.any(Object),
      });
    });
  });

  describe('addComment', () => {
    it('should add comment successfully', async () => {
      const createCommentDto: CreateAgreementCommentDto = {
        agreementId: 'agreement-1',
        content: 'This is a test comment',
      };

      const result = await service.addComment(createCommentDto, 'user-1');

      expect(result).toMatchObject({
        agreementId: 'agreement-1',
        content: 'This is a test comment',
        userId: 'user-1',
        replies: [],
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('agreement_comments');
    });

    it('should add reply to existing comment', async () => {
      const createCommentDto: CreateAgreementCommentDto = {
        agreementId: 'agreement-1',
        content: 'This is a reply',
        parentCommentId: 'comment-1',
      };

      // Mock getCommentById
      const mockCommentDoc = {
        exists: true,
        data: () => mockCommentDocument,
      };
      mockFirestore.collection().doc().get.mockResolvedValue(mockCommentDoc);

      const result = await service.addComment(createCommentDto, 'user-2');

      expect(result.parentCommentId).toBe('comment-1');
    });
  });

  describe('getAgreementComments', () => {
    it('should return organized comments with replies', async () => {
      const parentComment = {
        id: 'comment-1',
        agreementId: 'agreement-1',
        userId: 'user-1',
        content: 'Parent comment',
        createdAt: { toDate: () => new Date('2024-02-02T10:00:00Z') },
        updatedAt: { toDate: () => new Date('2024-02-02T10:00:00Z') },
      };

      const replyComment = {
        id: 'comment-2',
        agreementId: 'agreement-1',
        userId: 'user-2',
        content: 'Reply comment',
        parentCommentId: 'comment-1',
        createdAt: { toDate: () => new Date('2024-02-02T11:00:00Z') },
        updatedAt: { toDate: () => new Date('2024-02-02T11:00:00Z') },
      };

      const mockSnapshot = {
        forEach: jest.fn((callback) => {
          callback({ data: () => parentComment });
          callback({ data: () => replyComment });
        }),
      };

      mockFirestore.collection().where().orderBy().get.mockResolvedValue(mockSnapshot);

      const result = await service.getAgreementComments('agreement-1');

      expect(result).toHaveLength(1); // Only top-level comments
      expect(result[0].replies).toHaveLength(1); // Reply should be nested
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and replies when user is author', async () => {
      const mockCommentDoc = {
        exists: true,
        data: () => mockCommentDocument,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockCommentDoc);

      await service.deleteComment('comment-1', 'user-1', UserRole.RESIDENT);

      expect(mockFirestore.batch().commit).toHaveBeenCalled();
    });

    it('should delete comment when user is admin', async () => {
      const mockCommentDoc = {
        exists: true,
        data: () => mockCommentDocument,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockCommentDoc);

      await service.deleteComment('comment-1', 'other-user', UserRole.ADMIN);

      expect(mockFirestore.batch().commit).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      const mockCommentDoc = {
        exists: true,
        data: () => mockCommentDocument,
      };

      mockFirestore.collection().doc().get.mockResolvedValue(mockCommentDoc);

      await expect(
        service.deleteComment('comment-1', 'other-user', UserRole.RESIDENT)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAgreements', () => {
    it('should return agreements with filters', async () => {
      const queryDto = {
        status: 'active' as AgreementStatus,
        meetingId: 'meeting-1',
      };

      const result = await service.getAgreements(queryDto);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'agreement-1',
        title: 'Community Pool Rules',
      });

      expect(mockFirestore.collection().where).toHaveBeenCalledWith('status', '==', 'active');
      expect(mockFirestore.collection().where).toHaveBeenCalledWith('meetingId', '==', 'meeting-1');
    });
  });
});