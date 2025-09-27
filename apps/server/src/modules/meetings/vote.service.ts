import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Vote, 
  CreateVoteDto, 
  CastVoteDto, 
  VoteQueryDto,
  VoteStatus,
  UserRole
} from '@home-management/types';
import { 
  FIRESTORE_COLLECTIONS, 
  voteToFirestoreDocument, 
  firestoreDocumentToVote,
  validateVoteDocument,
  VOTE_FIELD_PATHS
} from '@home-management/utils';
import { MeetingService } from './meeting.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseConfigService } from '../../config/firebase.config';

@Injectable()
export class VoteService {
  private readonly firestore;

  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    private readonly meetingService: MeetingService,
    private readonly notificationService: NotificationService,
  ) {
    this.firestore = this.firebaseConfig.getFirestore();
  }

  async createVote(createVoteDto: CreateVoteDto, createdBy: string): Promise<Vote> {
    // Verify meeting exists
    const meeting = await this.meetingService.getMeetingById(createVoteDto.meetingId);
    
    const voteId = this.firestore.collection(FIRESTORE_COLLECTIONS.VOTES).doc().id;
    
    const vote: Vote = {
      id: voteId,
      ...createVoteDto,
      votes: {},
      results: createVoteDto.options.reduce((acc, option) => {
        acc[option] = 0;
        return acc;
      }, {} as Record<string, number>),
      status: 'active' as VoteStatus,
      createdBy,
      isAnonymous: createVoteDto.isAnonymous || false,
      allowMultipleChoices: createVoteDto.allowMultipleChoices || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const voteDoc = voteToFirestoreDocument(vote);
    
    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.VOTES)
      .doc(voteId)
      .set({
        ...voteDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    // Send notifications to meeting attendees
    await this.notificationService.sendVoteNotification(
      vote,
      meeting,
      'vote_created',
      meeting.attendees
    );

    return vote;
  }

  async getVoteById(voteId: string): Promise<Vote> {
    const doc = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.VOTES)
      .doc(voteId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(`Vote with ID ${voteId} not found`);
    }

    const data = doc.data();
    if (!validateVoteDocument(data)) {
      throw new BadRequestException('Invalid vote document structure');
    }

    return firestoreDocumentToVote(data);
  }

  async castVote(castVoteDto: CastVoteDto, userId: string): Promise<Vote> {
    const vote = await this.getVoteById(castVoteDto.voteId);
    
    // Check if vote is active
    if (vote.status !== 'active') {
      throw new BadRequestException('This vote is no longer active');
    }

    // Verify meeting exists and user is attendee
    const meeting = await this.meetingService.getMeetingById(vote.meetingId);
    if (!meeting.attendees.includes(userId)) {
      throw new ForbiddenException('You are not authorized to vote in this meeting');
    }

    // Validate selected options
    const invalidOptions = castVoteDto.selectedOptions.filter(
      option => !vote.options.includes(option)
    );
    if (invalidOptions.length > 0) {
      throw new BadRequestException(`Invalid vote options: ${invalidOptions.join(', ')}`);
    }

    // Check multiple choice constraint
    if (!vote.allowMultipleChoices && castVoteDto.selectedOptions.length > 1) {
      throw new BadRequestException('Multiple choices are not allowed for this vote');
    }

    // Update vote counts
    const updatedVotes = { ...vote.votes };
    const updatedResults = { ...vote.results };

    // Remove previous vote if exists
    const previousVote = updatedVotes[userId];
    if (previousVote) {
      if (vote.allowMultipleChoices) {
        // For multiple choice, previous vote is an array
        const previousOptions = Array.isArray(previousVote) ? previousVote : [previousVote];
        previousOptions.forEach(option => {
          if (updatedResults[option] > 0) {
            updatedResults[option]--;
          }
        });
      } else {
        // For single choice, previous vote is a string
        if (updatedResults[previousVote] > 0) {
          updatedResults[previousVote]--;
        }
      }
    }

    // Add new vote
    if (vote.allowMultipleChoices) {
      updatedVotes[userId] = castVoteDto.selectedOptions.join(',');
      castVoteDto.selectedOptions.forEach(option => {
        updatedResults[option] = (updatedResults[option] || 0) + 1;
      });
    } else {
      updatedVotes[userId] = castVoteDto.selectedOptions[0];
      updatedResults[castVoteDto.selectedOptions[0]] = (updatedResults[castVoteDto.selectedOptions[0]] || 0) + 1;
    }

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.VOTES)
      .doc(castVoteDto.voteId)
      .update({
        votes: updatedVotes,
        results: updatedResults,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return this.getVoteById(castVoteDto.voteId);
  }

  async closeVote(voteId: string, userId: string, userRole: UserRole): Promise<Vote> {
    const vote = await this.getVoteById(voteId);
    
    // Check permissions - only creator or admin can close vote
    if (vote.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to close this vote');
    }

    // Check if vote is active
    if (vote.status !== 'active') {
      throw new BadRequestException('Vote is not active');
    }

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.VOTES)
      .doc(voteId)
      .update({
        status: 'closed',
        closedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    const closedVote = await this.getVoteById(voteId);
    const meeting = await this.meetingService.getMeetingById(vote.meetingId);

    // Send notifications about closed vote
    await this.notificationService.sendVoteNotification(
      closedVote,
      meeting,
      'vote_closed',
      meeting.attendees
    );

    return closedVote;
  }

  async cancelVote(voteId: string, userId: string, userRole: UserRole): Promise<Vote> {
    const vote = await this.getVoteById(voteId);
    
    // Check permissions - only creator or admin can cancel vote
    if (vote.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to cancel this vote');
    }

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.VOTES)
      .doc(voteId)
      .update({
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });

    return this.getVoteById(voteId);
  }

  async getVotes(queryDto: VoteQueryDto): Promise<Vote[]> {
    let query: any = this.firestore.collection(FIRESTORE_COLLECTIONS.VOTES);

    // Apply filters
    if (queryDto.meetingId) {
      query = query.where(VOTE_FIELD_PATHS.MEETING_ID, '==', queryDto.meetingId);
    }

    if (queryDto.status) {
      query = query.where(VOTE_FIELD_PATHS.STATUS, '==', queryDto.status);
    }

    if (queryDto.createdBy) {
      query = query.where(VOTE_FIELD_PATHS.CREATED_BY, '==', queryDto.createdBy);
    }

    // Order by creation date
    query = query.orderBy(VOTE_FIELD_PATHS.CREATED_AT, 'desc');

    const snapshot = await query.get();
    const votes: Vote[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (validateVoteDocument(data)) {
        votes.push(firestoreDocumentToVote(data));
      }
    });

    return votes;
  }

  async getVotesByMeeting(meetingId: string): Promise<Vote[]> {
    return this.getVotes({ meetingId });
  }

  async getActiveVotes(): Promise<Vote[]> {
    return this.getVotes({ status: 'active' });
  }

  async getUserVoteStatus(voteId: string, userId: string): Promise<{
    hasVoted: boolean;
    selectedOptions?: string[];
  }> {
    const vote = await this.getVoteById(voteId);
    
    const userVote = vote.votes[userId];
    if (!userVote) {
      return { hasVoted: false };
    }

    const selectedOptions = vote.allowMultipleChoices 
      ? userVote.split(',')
      : [userVote];

    return {
      hasVoted: true,
      selectedOptions,
    };
  }

  async getVoteResults(voteId: string, userId: string): Promise<{
    vote: Vote;
    totalVotes: number;
    participationRate: number;
  }> {
    const vote = await this.getVoteById(voteId);
    const meeting = await this.meetingService.getMeetingById(vote.meetingId);
    
    // Check if user can view results
    if (!meeting.attendees.includes(userId)) {
      throw new ForbiddenException('You are not authorized to view results for this vote');
    }

    const totalVotes = Object.keys(vote.votes).length;
    const participationRate = meeting.attendees.length > 0 
      ? (totalVotes / meeting.attendees.length) * 100 
      : 0;

    return {
      vote,
      totalVotes,
      participationRate,
    };
  }
}