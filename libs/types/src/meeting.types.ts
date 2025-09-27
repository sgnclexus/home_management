import { BaseEntity } from './common.types';

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type VoteStatus = 'active' | 'closed' | 'cancelled';
export type AgreementStatus = 'draft' | 'active' | 'expired' | 'cancelled';

export interface Meeting extends BaseEntity {
  title: string;
  description: string;
  scheduledDate: Date;
  agenda: string[];
  notes?: string;
  status: MeetingStatus;
  attendees: string[];
  createdBy: string;
  location?: string;
  duration?: number; // in minutes
  attachments?: string[];
}

export interface Vote extends BaseEntity {
  meetingId: string;
  question: string;
  description?: string;
  options: string[];
  votes: Record<string, string>; // userId -> selectedOption
  results: Record<string, number>; // option -> count
  status: VoteStatus;
  closedAt?: Date;
  createdBy: string;
  isAnonymous: boolean;
  allowMultipleChoices: boolean;
}

export interface Agreement extends BaseEntity {
  title: string;
  description: string;
  content: string;
  status: AgreementStatus;
  meetingId?: string;
  voteId?: string;
  approvedBy: string[];
  rejectedBy: string[];
  comments: AgreementComment[];
  effectiveDate?: Date;
  expirationDate?: Date;
  createdBy: string;
}

export interface AgreementComment extends BaseEntity {
  agreementId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  replies?: AgreementComment[];
}

// DTOs for API requests
export interface CreateMeetingDto {
  title: string;
  description: string;
  scheduledDate: Date;
  agenda: string[];
  attendees: string[];
  location?: string;
  duration?: number;
}

export interface UpdateMeetingDto {
  title?: string;
  description?: string;
  scheduledDate?: Date;
  agenda?: string[];
  notes?: string;
  status?: MeetingStatus;
  location?: string;
  duration?: number;
}

export interface CreateVoteDto {
  meetingId: string;
  question: string;
  description?: string;
  options: string[];
  isAnonymous?: boolean;
  allowMultipleChoices?: boolean;
}

export interface CastVoteDto {
  voteId: string;
  selectedOptions: string[];
}

export interface CreateAgreementDto {
  title: string;
  description: string;
  content: string;
  meetingId?: string;
  voteId?: string;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface UpdateAgreementDto {
  title?: string;
  description?: string;
  content?: string;
  status?: AgreementStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
}

export interface CreateAgreementCommentDto {
  agreementId: string;
  content: string;
  parentCommentId?: string;
}

// Query DTOs
export interface MeetingQueryDto {
  status?: MeetingStatus;
  startDate?: Date;
  endDate?: Date;
  createdBy?: string;
  attendeeId?: string;
}

export interface VoteQueryDto {
  meetingId?: string;
  status?: VoteStatus;
  createdBy?: string;
}

export interface AgreementQueryDto {
  status?: AgreementStatus;
  meetingId?: string;
  createdBy?: string;
}