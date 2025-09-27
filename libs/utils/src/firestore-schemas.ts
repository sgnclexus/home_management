import { 
  UserDocument, 
  User, 
  UserRole, 
  Language,
  Payment,
  PaymentDocument,
  PaymentTransactionLog,
  PaymentTransactionLogDocument,
  AuditLog,
  AuditLogDocument,
  Reservation,
  ReservationDocument,
  CommonArea,
  CommonAreaDocument,
  Meeting,
  MeetingDocument,
  Vote,
  VoteDocument,
  Agreement,
  AgreementDocument,
  AgreementComment,
  AgreementCommentDocument,
  Timestamp
} from '@home-management/types';

/**
 * Convert User entity to Firestore document
 */
export const userToFirestoreDocument = (user: User): Omit<UserDocument, 'createdAt' | 'updatedAt'> => {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    apartmentNumber: user.apartmentNumber,
    phoneNumber: user.phoneNumber,
    preferredLanguage: user.preferredLanguage,
    isActive: user.isActive,
    fcmToken: user.fcmToken,
  };
};

/**
 * Convert Firestore document to User entity
 */
export const firestoreDocumentToUser = (doc: UserDocument): User => {
  return {
    id: doc.uid,
    uid: doc.uid,
    email: doc.email,
    displayName: doc.displayName,
    role: doc.role,
    apartmentNumber: doc.apartmentNumber,
    phoneNumber: doc.phoneNumber,
    preferredLanguage: doc.preferredLanguage,
    isActive: doc.isActive,
    fcmToken: doc.fcmToken,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Validate Firestore user document structure
 */
export const validateUserDocument = (doc: any): doc is UserDocument => {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  // Required fields
  if (typeof doc.uid !== 'string' || !doc.uid) {
    return false;
  }

  if (typeof doc.email !== 'string' || !doc.email) {
    return false;
  }

  if (typeof doc.displayName !== 'string' || !doc.displayName) {
    return false;
  }

  if (!Object.values(UserRole).includes(doc.role)) {
    return false;
  }

  if (!['es', 'en'].includes(doc.preferredLanguage)) {
    return false;
  }

  if (typeof doc.isActive !== 'boolean') {
    return false;
  }

  // Optional fields validation
  if (doc.apartmentNumber !== undefined && typeof doc.apartmentNumber !== 'string') {
    return false;
  }

  if (doc.phoneNumber !== undefined && typeof doc.phoneNumber !== 'string') {
    return false;
  }

  if (doc.fcmToken !== undefined && typeof doc.fcmToken !== 'string') {
    return false;
  }

  // Timestamp validation
  if (!doc.createdAt || typeof doc.createdAt.toDate !== 'function') {
    return false;
  }

  if (!doc.updatedAt || typeof doc.updatedAt.toDate !== 'function') {
    return false;
  }

  return true;
};

/**
 * Create default user document structure
 */
export const createDefaultUserDocument = (
  uid: string,
  email: string,
  displayName: string,
  role: UserRole = UserRole.RESIDENT,
  preferredLanguage: Language = 'es'
): Omit<UserDocument, 'createdAt' | 'updatedAt'> => {
  return {
    uid,
    email,
    displayName,
    role,
    preferredLanguage,
    isActive: true,
  };
};

/**
 * Firestore collection names
 */
export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  PAYMENTS: 'payments',
  PAYMENT_TRANSACTION_LOGS: 'payment_transaction_logs',
  RESERVATIONS: 'reservations',
  COMMON_AREAS: 'common_areas',
  MEETINGS: 'meetings',
  VOTES: 'votes',
  AGREEMENTS: 'agreements',
  AGREEMENT_COMMENTS: 'agreement_comments',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
} as const;

/**
 * User document field paths for Firestore queries
 */
export const USER_FIELD_PATHS = {
  UID: 'uid',
  EMAIL: 'email',
  DISPLAY_NAME: 'displayName',
  ROLE: 'role',
  APARTMENT_NUMBER: 'apartmentNumber',
  PHONE_NUMBER: 'phoneNumber',
  PREFERRED_LANGUAGE: 'preferredLanguage',
  IS_ACTIVE: 'isActive',
  FCM_TOKEN: 'fcmToken',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Convert Payment entity to Firestore document
 */
export const paymentToFirestoreDocument = (payment: Payment): Omit<PaymentDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: payment.id,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    status: payment.status,
    dueDate: { seconds: Math.floor(payment.dueDate.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    paidDate: payment.paidDate ? { seconds: Math.floor(payment.paidDate.getTime() / 1000), nanoseconds: 0 } as Timestamp : undefined,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
  };
};

/**
 * Convert Firestore document to Payment entity
 */
export const firestoreDocumentToPayment = (doc: PaymentDocument): Payment => {
  return {
    id: doc.id,
    userId: doc.userId,
    amount: doc.amount,
    currency: doc.currency,
    description: doc.description,
    status: doc.status,
    dueDate: doc.dueDate.toDate(),
    paidDate: doc.paidDate?.toDate(),
    paymentMethod: doc.paymentMethod,
    transactionId: doc.transactionId,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Convert PaymentTransactionLog entity to Firestore document
 */
export const paymentTransactionLogToFirestoreDocument = (
  log: PaymentTransactionLog
): Omit<PaymentTransactionLogDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: log.id,
    paymentId: log.paymentId,
    userId: log.userId,
    action: log.action,
    provider: log.provider,
    providerTransactionId: log.providerTransactionId,
    providerResponse: log.providerResponse,
    amount: log.amount,
    currency: log.currency,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    timestamp: { seconds: Math.floor(log.timestamp.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    metadata: log.metadata,
  };
};

/**
 * Convert Firestore document to PaymentTransactionLog entity
 */
export const firestoreDocumentToPaymentTransactionLog = (doc: PaymentTransactionLogDocument): PaymentTransactionLog => {
  return {
    id: doc.id,
    paymentId: doc.paymentId,
    userId: doc.userId,
    action: doc.action,
    provider: doc.provider,
    providerTransactionId: doc.providerTransactionId,
    providerResponse: doc.providerResponse,
    amount: doc.amount,
    currency: doc.currency,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    timestamp: doc.timestamp.toDate(),
    metadata: doc.metadata,
    createdAt: doc.timestamp.toDate(), // Use timestamp as createdAt for logs
    updatedAt: doc.timestamp.toDate(), // Use timestamp as updatedAt for logs
  };
};

/**
 * Convert AuditLog entity to Firestore document
 */
export const auditLogToFirestoreDocument = (log: AuditLog): Omit<AuditLogDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: log.id,
    type: log.type,
    action: log.action,
    userId: log.userId,
    entityId: log.entityId,
    entityType: log.entityType,
    details: log.details,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    timestamp: { seconds: Math.floor(log.timestamp.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    severity: log.severity,
  };
};

/**
 * Convert Firestore document to AuditLog entity
 */
export const firestoreDocumentToAuditLog = (doc: AuditLogDocument): AuditLog => {
  return {
    id: doc.id,
    type: doc.type,
    action: doc.action,
    userId: doc.userId,
    entityId: doc.entityId,
    entityType: doc.entityType,
    details: doc.details,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    timestamp: doc.timestamp.toDate(),
    severity: doc.severity,
    createdAt: doc.timestamp.toDate(), // Use timestamp as createdAt for audit logs
    updatedAt: doc.timestamp.toDate(), // Use timestamp as updatedAt for audit logs
  };
};

/**
 * Validate Payment document structure
 */
export const validatePaymentDocument = (doc: any): doc is PaymentDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.userId === 'string' &&
    typeof doc.amount === 'number' &&
    typeof doc.currency === 'string' &&
    typeof doc.description === 'string' &&
    ['pending', 'paid', 'overdue', 'cancelled'].includes(doc.status) &&
    doc.dueDate && typeof doc.dueDate.toDate === 'function' &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Validate PaymentTransactionLog document structure
 */
export const validatePaymentTransactionLogDocument = (doc: any): doc is PaymentTransactionLogDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.paymentId === 'string' &&
    typeof doc.userId === 'string' &&
    ['created', 'processed', 'failed', 'refunded', 'cancelled'].includes(doc.action) &&
    ['stripe', 'paypal'].includes(doc.provider) &&
    typeof doc.amount === 'number' &&
    typeof doc.currency === 'string' &&
    typeof doc.ipAddress === 'string' &&
    typeof doc.userAgent === 'string' &&
    doc.timestamp && typeof doc.timestamp.toDate === 'function'
  );
};

/**
 * Payment document field paths for Firestore queries
 */
export const PAYMENT_FIELD_PATHS = {
  ID: 'id',
  USER_ID: 'userId',
  AMOUNT: 'amount',
  CURRENCY: 'currency',
  DESCRIPTION: 'description',
  STATUS: 'status',
  DUE_DATE: 'dueDate',
  PAID_DATE: 'paidDate',
  PAYMENT_METHOD: 'paymentMethod',
  TRANSACTION_ID: 'transactionId',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Audit log document field paths for Firestore queries
 */
export const AUDIT_LOG_FIELD_PATHS = {
  ID: 'id',
  TYPE: 'type',
  ACTION: 'action',
  USER_ID: 'userId',
  ENTITY_ID: 'entityId',
  ENTITY_TYPE: 'entityType',
  DETAILS: 'details',
  IP_ADDRESS: 'ipAddress',
  USER_AGENT: 'userAgent',
  TIMESTAMP: 'timestamp',
  SEVERITY: 'severity',
} as const;

/**
 * Convert Reservation entity to Firestore document
 */
export const reservationToFirestoreDocument = (reservation: Reservation): Omit<ReservationDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: reservation.id,
    userId: reservation.userId,
    areaId: reservation.areaId,
    areaName: reservation.areaName,
    startTime: { seconds: Math.floor(reservation.startTime.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    endTime: { seconds: Math.floor(reservation.endTime.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    status: reservation.status,
    notes: reservation.notes,
  };
};

/**
 * Convert Firestore document to Reservation entity
 */
export const firestoreDocumentToReservation = (doc: ReservationDocument): Reservation => {
  return {
    id: doc.id,
    userId: doc.userId,
    areaId: doc.areaId,
    areaName: doc.areaName,
    startTime: doc.startTime.toDate(),
    endTime: doc.endTime.toDate(),
    status: doc.status,
    notes: doc.notes,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Convert CommonArea entity to Firestore document
 */
export const commonAreaToFirestoreDocument = (area: CommonArea): Omit<CommonAreaDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: area.id,
    name: area.name,
    description: area.description,
    capacity: area.capacity,
    availableHours: area.availableHours,
    isActive: area.isActive,
    rules: area.rules,
  };
};

/**
 * Convert Firestore document to CommonArea entity
 */
export const firestoreDocumentToCommonArea = (doc: CommonAreaDocument): CommonArea => {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    capacity: doc.capacity,
    availableHours: doc.availableHours,
    isActive: doc.isActive,
    rules: doc.rules,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Validate Reservation document structure
 */
export const validateReservationDocument = (doc: any): doc is ReservationDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.userId === 'string' &&
    typeof doc.areaId === 'string' &&
    typeof doc.areaName === 'string' &&
    doc.startTime && typeof doc.startTime.toDate === 'function' &&
    doc.endTime && typeof doc.endTime.toDate === 'function' &&
    ['confirmed', 'cancelled', 'completed'].includes(doc.status) &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Validate CommonArea document structure
 */
export const validateCommonAreaDocument = (doc: any): doc is CommonAreaDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.name === 'string' &&
    typeof doc.description === 'string' &&
    typeof doc.capacity === 'number' &&
    doc.availableHours &&
    typeof doc.availableHours.start === 'string' &&
    typeof doc.availableHours.end === 'string' &&
    typeof doc.isActive === 'boolean' &&
    Array.isArray(doc.rules) &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Reservation document field paths for Firestore queries
 */
export const RESERVATION_FIELD_PATHS = {
  ID: 'id',
  USER_ID: 'userId',
  AREA_ID: 'areaId',
  AREA_NAME: 'areaName',
  START_TIME: 'startTime',
  END_TIME: 'endTime',
  STATUS: 'status',
  NOTES: 'notes',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Common area document field paths for Firestore queries
 */
export const COMMON_AREA_FIELD_PATHS = {
  ID: 'id',
  NAME: 'name',
  DESCRIPTION: 'description',
  CAPACITY: 'capacity',
  AVAILABLE_HOURS: 'availableHours',
  IS_ACTIVE: 'isActive',
  RULES: 'rules',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Convert Meeting entity to Firestore document
 */
export const meetingToFirestoreDocument = (meeting: Meeting): Omit<MeetingDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    scheduledDate: { seconds: Math.floor(meeting.scheduledDate.getTime() / 1000), nanoseconds: 0 } as Timestamp,
    agenda: meeting.agenda,
    notes: meeting.notes,
    status: meeting.status,
    attendees: meeting.attendees,
    createdBy: meeting.createdBy,
    location: meeting.location,
    duration: meeting.duration,
    attachments: meeting.attachments,
  };
};

/**
 * Convert Firestore document to Meeting entity
 */
export const firestoreDocumentToMeeting = (doc: MeetingDocument): Meeting => {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    scheduledDate: doc.scheduledDate.toDate(),
    agenda: doc.agenda,
    notes: doc.notes,
    status: doc.status,
    attendees: doc.attendees,
    createdBy: doc.createdBy,
    location: doc.location,
    duration: doc.duration,
    attachments: doc.attachments,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Convert Vote entity to Firestore document
 */
export const voteToFirestoreDocument = (vote: Vote): Omit<VoteDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: vote.id,
    meetingId: vote.meetingId,
    question: vote.question,
    description: vote.description,
    options: vote.options,
    votes: vote.votes,
    results: vote.results,
    status: vote.status,
    closedAt: vote.closedAt ? { seconds: Math.floor(vote.closedAt.getTime() / 1000), nanoseconds: 0 } as Timestamp : undefined,
    createdBy: vote.createdBy,
    isAnonymous: vote.isAnonymous,
    allowMultipleChoices: vote.allowMultipleChoices,
  };
};

/**
 * Convert Firestore document to Vote entity
 */
export const firestoreDocumentToVote = (doc: VoteDocument): Vote => {
  return {
    id: doc.id,
    meetingId: doc.meetingId,
    question: doc.question,
    description: doc.description,
    options: doc.options,
    votes: doc.votes,
    results: doc.results,
    status: doc.status,
    closedAt: doc.closedAt?.toDate(),
    createdBy: doc.createdBy,
    isAnonymous: doc.isAnonymous,
    allowMultipleChoices: doc.allowMultipleChoices,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Convert Agreement entity to Firestore document
 */
export const agreementToFirestoreDocument = (agreement: Agreement): Omit<AgreementDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: agreement.id,
    title: agreement.title,
    description: agreement.description,
    content: agreement.content,
    status: agreement.status,
    meetingId: agreement.meetingId,
    voteId: agreement.voteId,
    approvedBy: agreement.approvedBy,
    rejectedBy: agreement.rejectedBy,
    effectiveDate: agreement.effectiveDate ? { seconds: Math.floor(agreement.effectiveDate.getTime() / 1000), nanoseconds: 0 } as Timestamp : undefined,
    expirationDate: agreement.expirationDate ? { seconds: Math.floor(agreement.expirationDate.getTime() / 1000), nanoseconds: 0 } as Timestamp : undefined,
    createdBy: agreement.createdBy,
  };
};

/**
 * Convert Firestore document to Agreement entity
 */
export const firestoreDocumentToAgreement = (doc: AgreementDocument): Agreement => {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    content: doc.content,
    status: doc.status,
    meetingId: doc.meetingId,
    voteId: doc.voteId,
    approvedBy: doc.approvedBy,
    rejectedBy: doc.rejectedBy,
    comments: [], // Comments will be loaded separately
    effectiveDate: doc.effectiveDate?.toDate(),
    expirationDate: doc.expirationDate?.toDate(),
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Convert AgreementComment entity to Firestore document
 */
export const agreementCommentToFirestoreDocument = (comment: AgreementComment): Omit<AgreementCommentDocument, 'createdAt' | 'updatedAt'> => {
  return {
    id: comment.id,
    agreementId: comment.agreementId,
    userId: comment.userId,
    content: comment.content,
    parentCommentId: comment.parentCommentId,
  };
};

/**
 * Convert Firestore document to AgreementComment entity
 */
export const firestoreDocumentToAgreementComment = (doc: AgreementCommentDocument): AgreementComment => {
  return {
    id: doc.id,
    agreementId: doc.agreementId,
    userId: doc.userId,
    content: doc.content,
    parentCommentId: doc.parentCommentId,
    replies: [], // Replies will be loaded separately
    createdAt: doc.createdAt.toDate(),
    updatedAt: doc.updatedAt.toDate(),
  };
};

/**
 * Validate Meeting document structure
 */
export const validateMeetingDocument = (doc: any): doc is MeetingDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.description === 'string' &&
    doc.scheduledDate && typeof doc.scheduledDate.toDate === 'function' &&
    Array.isArray(doc.agenda) &&
    ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(doc.status) &&
    Array.isArray(doc.attendees) &&
    typeof doc.createdBy === 'string' &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Validate Vote document structure
 */
export const validateVoteDocument = (doc: any): doc is VoteDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.meetingId === 'string' &&
    typeof doc.question === 'string' &&
    Array.isArray(doc.options) &&
    typeof doc.votes === 'object' &&
    typeof doc.results === 'object' &&
    ['active', 'closed', 'cancelled'].includes(doc.status) &&
    typeof doc.createdBy === 'string' &&
    typeof doc.isAnonymous === 'boolean' &&
    typeof doc.allowMultipleChoices === 'boolean' &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Validate Agreement document structure
 */
export const validateAgreementDocument = (doc: any): doc is AgreementDocument => {
  if (!doc || typeof doc !== 'object') return false;
  
  return (
    typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.description === 'string' &&
    typeof doc.content === 'string' &&
    ['draft', 'active', 'expired', 'cancelled'].includes(doc.status) &&
    Array.isArray(doc.approvedBy) &&
    Array.isArray(doc.rejectedBy) &&
    typeof doc.createdBy === 'string' &&
    doc.createdAt && typeof doc.createdAt.toDate === 'function' &&
    doc.updatedAt && typeof doc.updatedAt.toDate === 'function'
  );
};

/**
 * Meeting document field paths for Firestore queries
 */
export const MEETING_FIELD_PATHS = {
  ID: 'id',
  TITLE: 'title',
  DESCRIPTION: 'description',
  SCHEDULED_DATE: 'scheduledDate',
  AGENDA: 'agenda',
  NOTES: 'notes',
  STATUS: 'status',
  ATTENDEES: 'attendees',
  CREATED_BY: 'createdBy',
  LOCATION: 'location',
  DURATION: 'duration',
  ATTACHMENTS: 'attachments',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Vote document field paths for Firestore queries
 */
export const VOTE_FIELD_PATHS = {
  ID: 'id',
  MEETING_ID: 'meetingId',
  QUESTION: 'question',
  DESCRIPTION: 'description',
  OPTIONS: 'options',
  VOTES: 'votes',
  RESULTS: 'results',
  STATUS: 'status',
  CLOSED_AT: 'closedAt',
  CREATED_BY: 'createdBy',
  IS_ANONYMOUS: 'isAnonymous',
  ALLOW_MULTIPLE_CHOICES: 'allowMultipleChoices',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

/**
 * Agreement document field paths for Firestore queries
 */
export const AGREEMENT_FIELD_PATHS = {
  ID: 'id',
  TITLE: 'title',
  DESCRIPTION: 'description',
  CONTENT: 'content',
  STATUS: 'status',
  MEETING_ID: 'meetingId',
  VOTE_ID: 'voteId',
  APPROVED_BY: 'approvedBy',
  REJECTED_BY: 'rejectedBy',
  EFFECTIVE_DATE: 'effectiveDate',
  EXPIRATION_DATE: 'expirationDate',
  CREATED_BY: 'createdBy',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;