// Firebase configuration types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Firebase Admin configuration types
export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseURL?: string;
}

// Firebase service types
export interface FirebaseServices {
  auth: any;
  firestore: any;
  functions: any;
  messaging?: any;
}

// Environment configuration types
export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  apiPort: number;
  jwtSecret: string;
  corsOrigin: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// Firestore document types
export interface Timestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
}



export interface PaymentDocument {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Timestamp;
  paidDate?: Timestamp;
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentTransactionLogDocument {
  id: string;
  paymentId: string;
  userId: string;
  action: 'created' | 'processed' | 'failed' | 'refunded' | 'cancelled';
  provider: 'stripe' | 'paypal';
  providerTransactionId?: string;
  providerResponse: any;
  amount: number;
  currency: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export interface AuditLogDocument {
  id: string;
  type: 'payment' | 'user_action' | 'system_event';
  action: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ReservationDocument {
  id: string;
  userId: string;
  areaId: string;
  areaName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  status: 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommonAreaDocument {
  id: string;
  name: string;
  description: string;
  capacity: number;
  availableHours: {
    start: string;
    end: string;
  };
  isActive: boolean;
  rules: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MeetingDocument {
  id: string;
  title: string;
  description: string;
  scheduledDate: Timestamp;
  agenda: string[];
  notes?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendees: string[];
  createdBy: string;
  location?: string;
  duration?: number;
  attachments?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VoteDocument {
  id: string;
  meetingId: string;
  question: string;
  description?: string;
  options: string[];
  votes: Record<string, string>;
  results: Record<string, number>;
  status: 'active' | 'closed' | 'cancelled';
  closedAt?: Timestamp;
  createdBy: string;
  isAnonymous: boolean;
  allowMultipleChoices: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AgreementDocument {
  id: string;
  title: string;
  description: string;
  content: string;
  status: 'draft' | 'active' | 'expired' | 'cancelled';
  meetingId?: string;
  voteId?: string;
  approvedBy: string[];
  rejectedBy: string[];
  effectiveDate?: Timestamp;
  expirationDate?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AgreementCommentDocument {
  id: string;
  agreementId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}