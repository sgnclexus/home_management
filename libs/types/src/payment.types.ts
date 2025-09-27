import { BaseEntity } from './common.types';

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'stripe' | 'paypal';
export type PaymentProvider = 'stripe' | 'paypal';

export interface Payment extends BaseEntity {
  userId: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  dueDate: Date;
  paidDate?: Date;
  paymentMethod?: string;
  transactionId?: string;
}

export interface CreatePaymentDto {
  userId: string;
  amount: number;
  currency: string;
  description: string;
  dueDate: Date;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface PaymentTransactionLog extends BaseEntity {
  paymentId: string;
  userId: string;
  action: 'created' | 'processed' | 'failed' | 'refunded' | 'cancelled';
  provider: PaymentProvider;
  providerTransactionId?: string;
  providerResponse: any;
  amount: number;
  currency: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentAuditEvent {
  type: 'payment_created' | 'payment_processed' | 'payment_failed' | 'payment_refunded';
  paymentId: string;
  userId: string;
  amount: number;
  provider: string;
  providerTransactionId?: string;
  providerResponse?: any;
  errorMessage?: string;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLog extends BaseEntity {
  type: 'payment' | 'user_action' | 'system_event';
  action: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface PaymentAuditReport {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalAmount: number;
  providerBreakdown: Record<string, number>;
  logs: PaymentTransactionLog[];
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  type?: string;
  action?: string;
  severity?: string;
}