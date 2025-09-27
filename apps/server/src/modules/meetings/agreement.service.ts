import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Agreement, 
  AgreementComment,
  CreateAgreementDto, 
  UpdateAgreementDto,
  CreateAgreementCommentDto,
  AgreementQueryDto,
  AgreementStatus,
  UserRole
} from '@home-management/types';
import { 
  FIRESTORE_COLLECTIONS, 
  agreementToFirestoreDocument, 
  firestoreDocumentToAgreement,
  agreementCommentToFirestoreDocument,
  firestoreDocumentToAgreementComment,
  validateAgreementDocument,
  AGREEMENT_FIELD_PATHS
} from '@home-management/utils';
import { MeetingService } from './meeting.service';
import { VoteService } from './vote.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseConfigService } from '../../config/firebase.config';

@Injectable()
export class AgreementService {
  private readonly firestore;

  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    private readonly meetingService: MeetingService,
    private readonly voteService: VoteService,
    private readonly notificationService: NotificationService,
  ) {
    this.firestore = this.firebaseConfig.getFirestore();
  }

  async createAgreement(createAgreementDto: CreateAgreementDto, createdBy: string): Promise<Agreement> {
    // Verify meeting exists if provided
    if (createAgreementDto.meetingId) {
      await this.meetingService.getMeetingById(createAgreementDto.meetingId);
    }

    // Verify vote exists if provided
    if (createAgreementDto.voteId) {
      await this.voteService.getVoteById(createAgreementDto.voteId);
    }

    const agreementId = this.firestore.collection(FIRESTORE_COLLECTIONS.AGREEMENTS).doc().id;
    
    const agreement: Agreement = {
      id: agreementId,
      ...createAgreementDto,
      status: 'draft' as AgreementStatus,
      approvedBy: [],
      rejectedBy: [],
      comments: [],
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const agreementDoc = agreementToFirestoreDocument(agreement);
    
    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENTS)
      .doc(agreementId)
      .set({
        ...agreementDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return agreement;
  }

  async getAgreementById(agreementId: string): Promise<Agreement> {
    const doc = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENTS)
      .doc(agreementId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(`Agreement with ID ${agreementId} not found`);
    }

    const data = doc.data();
    if (!validateAgreementDocument(data)) {
      throw new BadRequestException('Invalid agreement document structure');
    }

    const agreement = firestoreDocumentToAgreement(data);
    
    // Load comments
    agreement.comments = await this.getAgreementComments(agreementId);

    return agreement;
  }

  async updateAgreement(
    agreementId: string, 
    updateAgreementDto: UpdateAgreementDto, 
    userId: string,
    userRole: UserRole
  ): Promise<Agreement> {
    const agreement = await this.getAgreementById(agreementId);
    
    // Check permissions - only creator or admin can update
    if (agreement.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update this agreement');
    }

    const updateData = {
      ...updateAgreementDto,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Convert dates to Firestore timestamps if provided
    if (updateAgreementDto.effectiveDate) {
      (updateData as any).effectiveDate = {
        seconds: Math.floor(updateAgreementDto.effectiveDate.getTime() / 1000),
        nanoseconds: 0,
      };
    }

    if (updateAgreementDto.expirationDate) {
      (updateData as any).expirationDate = {
        seconds: Math.floor(updateAgreementDto.expirationDate.getTime() / 1000),
        nanoseconds: 0,
      };
    }

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENTS)
      .doc(agreementId)
      .update(updateData);

    const updatedAgreement = await this.getAgreementById(agreementId);

    // Send notifications if status changed to active
    if (updateAgreementDto.status === 'active') {
      await this.notificationService.sendAgreementNotification(
        updatedAgreement,
        'agreement_activated'
      );
    }

    return updatedAgreement;
  }

  async deleteAgreement(agreementId: string, userId: string, userRole: UserRole): Promise<void> {
    const agreement = await this.getAgreementById(agreementId);
    
    // Check permissions - only creator or admin can delete
    if (agreement.createdBy !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete this agreement');
    }

    // Check if agreement can be deleted (only draft agreements)
    if (agreement.status !== 'draft') {
      throw new BadRequestException('Only draft agreements can be deleted');
    }

    // Delete all comments first
    const commentsSnapshot = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS)
      .where('agreementId', '==', agreementId)
      .get();

    const batch = this.firestore.batch();
    commentsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the agreement
    batch.delete(
      this.firestore.collection(FIRESTORE_COLLECTIONS.AGREEMENTS).doc(agreementId)
    );

    await batch.commit();
  }

  async getAgreements(queryDto: AgreementQueryDto): Promise<Agreement[]> {
    let query: any = this.firestore.collection(FIRESTORE_COLLECTIONS.AGREEMENTS);

    // Apply filters
    if (queryDto.status) {
      query = query.where(AGREEMENT_FIELD_PATHS.STATUS, '==', queryDto.status);
    }

    if (queryDto.meetingId) {
      query = query.where(AGREEMENT_FIELD_PATHS.MEETING_ID, '==', queryDto.meetingId);
    }

    if (queryDto.createdBy) {
      query = query.where(AGREEMENT_FIELD_PATHS.CREATED_BY, '==', queryDto.createdBy);
    }

    // Order by creation date
    query = query.orderBy(AGREEMENT_FIELD_PATHS.CREATED_AT, 'desc');

    const snapshot = await query.get();
    const agreements: Agreement[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (validateAgreementDocument(data)) {
        const agreement = firestoreDocumentToAgreement(data);
        // Load comments for each agreement
        agreement.comments = await this.getAgreementComments(agreement.id);
        agreements.push(agreement);
      }
    }

    return agreements;
  }

  async approveAgreement(agreementId: string, userId: string): Promise<Agreement> {
    const agreement = await this.getAgreementById(agreementId);
    
    // Check if agreement is active
    if (agreement.status !== 'active') {
      throw new BadRequestException('Only active agreements can be approved');
    }

    // Remove from rejected list if present
    const rejectedBy = agreement.rejectedBy.filter(id => id !== userId);
    
    // Add to approved list if not already present
    const approvedBy = agreement.approvedBy.includes(userId) 
      ? agreement.approvedBy 
      : [...agreement.approvedBy, userId];

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENTS)
      .doc(agreementId)
      .update({
        approvedBy,
        rejectedBy,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return this.getAgreementById(agreementId);
  }

  async rejectAgreement(agreementId: string, userId: string): Promise<Agreement> {
    const agreement = await this.getAgreementById(agreementId);
    
    // Check if agreement is active
    if (agreement.status !== 'active') {
      throw new BadRequestException('Only active agreements can be rejected');
    }

    // Remove from approved list if present
    const approvedBy = agreement.approvedBy.filter(id => id !== userId);
    
    // Add to rejected list if not already present
    const rejectedBy = agreement.rejectedBy.includes(userId) 
      ? agreement.rejectedBy 
      : [...agreement.rejectedBy, userId];

    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENTS)
      .doc(agreementId)
      .update({
        approvedBy,
        rejectedBy,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return this.getAgreementById(agreementId);
  }

  async addComment(createCommentDto: CreateAgreementCommentDto, userId: string): Promise<AgreementComment> {
    // Verify agreement exists
    await this.getAgreementById(createCommentDto.agreementId);

    // Verify parent comment exists if provided
    if (createCommentDto.parentCommentId) {
      await this.getCommentById(createCommentDto.parentCommentId);
    }

    const commentId = this.firestore.collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS).doc().id;
    
    const comment: AgreementComment = {
      id: commentId,
      ...createCommentDto,
      userId,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const commentDoc = agreementCommentToFirestoreDocument(comment);
    
    await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS)
      .doc(commentId)
      .set({
        ...commentDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return comment;
  }

  async getCommentById(commentId: string): Promise<AgreementComment> {
    const doc = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS)
      .doc(commentId)
      .get();

    if (!doc.exists) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    const data = doc.data();
    return firestoreDocumentToAgreementComment(data);
  }

  async getAgreementComments(agreementId: string): Promise<AgreementComment[]> {
    const snapshot = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS)
      .where('agreementId', '==', agreementId)
      .orderBy('createdAt', 'asc')
      .get();

    const comments: AgreementComment[] = [];
    const commentMap = new Map<string, AgreementComment>();

    // First pass: create all comments
    snapshot.forEach((doc) => {
      const data = doc.data();
      const comment = firestoreDocumentToAgreementComment(data);
      comments.push(comment);
      commentMap.set(comment.id, comment);
    });

    // Second pass: organize replies
    const topLevelComments: AgreementComment[] = [];
    
    comments.forEach(comment => {
      if (comment.parentCommentId) {
        const parentComment = commentMap.get(comment.parentCommentId);
        if (parentComment) {
          parentComment.replies = parentComment.replies || [];
          parentComment.replies.push(comment);
        }
      } else {
        topLevelComments.push(comment);
      }
    });

    return topLevelComments;
  }

  async deleteComment(commentId: string, userId: string, userRole: UserRole): Promise<void> {
    const comment = await this.getCommentById(commentId);
    
    // Check permissions - only comment author or admin can delete
    if (comment.userId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }

    // Delete all replies first
    const repliesSnapshot = await this.firestore
      .collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS)
      .where('parentCommentId', '==', commentId)
      .get();

    const batch = this.firestore.batch();
    repliesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the comment
    batch.delete(
      this.firestore.collection(FIRESTORE_COLLECTIONS.AGREEMENT_COMMENTS).doc(commentId)
    );

    await batch.commit();
  }

  async getActiveAgreements(): Promise<Agreement[]> {
    return this.getAgreements({ status: 'active' });
  }

  async getAgreementsByMeeting(meetingId: string): Promise<Agreement[]> {
    return this.getAgreements({ meetingId });
  }

  async activateAgreement(agreementId: string, userId: string, userRole: UserRole): Promise<Agreement> {
    return this.updateAgreement(
      agreementId,
      { status: 'active' as AgreementStatus },
      userId,
      userRole
    );
  }

  async expireAgreement(agreementId: string, userId: string, userRole: UserRole): Promise<Agreement> {
    return this.updateAgreement(
      agreementId,
      { status: 'expired' as AgreementStatus },
      userId,
      userRole
    );
  }

  async cancelAgreement(agreementId: string, userId: string, userRole: UserRole): Promise<Agreement> {
    return this.updateAgreement(
      agreementId,
      { status: 'cancelled' as AgreementStatus },
      userId,
      userRole
    );
  }
}