import { Injectable, Logger } from '@nestjs/common';
import { 
  PaymentTransactionLog, 
  PaymentAuditEvent, 
  AuditLog, 
  PaymentAuditReport,
  AuditLogFilters 
} from '@home-management/types';
// Temporary inline utils until @home-management/utils is properly built
const FIRESTORE_COLLECTIONS = {
  PAYMENT_TRANSACTION_LOGS: 'payment_transaction_logs',
  AUDIT_LOGS: 'audit_logs',
} as const;

const paymentTransactionLogToFirestoreDocument = (log: PaymentTransactionLog) => {
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
    timestamp: log.timestamp,
    metadata: log.metadata,
  };
};

const firestoreDocumentToPaymentTransactionLog = (doc: any): PaymentTransactionLog => {
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
    timestamp: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
    metadata: doc.metadata,
    createdAt: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
    updatedAt: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
  };
};

const auditLogToFirestoreDocument = (log: AuditLog) => {
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
    timestamp: log.timestamp,
    severity: log.severity,
  };
};

const firestoreDocumentToAuditLog = (doc: any): AuditLog => {
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
    timestamp: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
    severity: doc.severity,
    createdAt: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
    updatedAt: doc.timestamp?.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp),
  };
};
import { ConfigService } from '@nestjs/config';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseConfigService } from '../../config/firebase.config';

@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Log a payment transaction with all relevant details
   */
  async logPaymentTransaction(transactionData: PaymentTransactionLog): Promise<void> {
    try {
      const logEntry = {
        ...paymentTransactionLogToFirestoreDocument(transactionData),
        timestamp: FieldValue.serverTimestamp(),
        environment: this.configService.get('NODE_ENV', 'development'),
        version: process.env.npm_package_version || '1.0.0',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTION_LOGS)
        .doc(transactionData.id)
        .set(logEntry);

      this.logger.log(`Payment transaction logged: ${transactionData.id}`);

      // Also log to external monitoring service if in production
      if (this.configService.get('NODE_ENV') === 'production') {
        await this.logToExternalService(logEntry);
      }
    } catch (error) {
      this.logger.error('Failed to log payment transaction:', error);
      // Don't throw error to avoid breaking payment flow
    }
  }

  /**
   * Log third-party payment provider responses
   */
  async logThirdPartyResponse(
    paymentId: string,
    provider: 'stripe' | 'paypal',
    response: any,
    success: boolean,
    userId: string,
    amount: number,
    currency: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const logData: PaymentTransactionLog = {
      id: `${paymentId}_${provider}_${Date.now()}`,
      paymentId,
      userId,
      action: success ? 'processed' : 'failed',
      provider,
      providerTransactionId: response.id || response.transaction_id,
      providerResponse: this.sanitizeResponse(response),
      amount,
      currency,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        success,
        errorCode: success ? undefined : response.error?.code,
        errorMessage: success ? undefined : response.error?.message,
      },
    };

    await this.logPaymentTransaction(logData);
  }

  /**
   * Log payment audit events to general audit log
   */
  async logPaymentEvent(event: PaymentAuditEvent): Promise<void> {
    try {
      const auditLog: AuditLog = {
        id: `payment_${event.paymentId}_${Date.now()}`,
        type: 'payment',
        action: event.type,
        userId: event.userId,
        entityId: event.paymentId,
        entityType: 'payment',
        details: {
          amount: event.amount,
          provider: event.provider,
          providerTransactionId: event.providerTransactionId,
          errorMessage: event.errorMessage,
          providerResponse: event.providerResponse,
        },
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date(),
        severity: event.type.includes('failed') ? 'error' : 'info',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const logEntry = {
        ...auditLogToFirestoreDocument(auditLog),
        timestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.AUDIT_LOGS)
        .doc(auditLog.id)
        .set(logEntry);

      this.logger.log(`Payment audit event logged: ${event.type} for payment ${event.paymentId}`);
    } catch (error) {
      this.logger.error('Failed to log payment audit event:', error);
    }
  }

  /**
   * Get payment audit report for a date range
   */
  async getPaymentAuditReport(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<PaymentAuditReport> {
    try {
      let query: any = this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTION_LOGS)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate);

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      const snapshot = await query.get();
      const logs = snapshot.docs.map(doc => 
        firestoreDocumentToPaymentTransactionLog(doc.data() as any)
      );

      return {
        totalTransactions: logs.length,
        successfulTransactions: logs.filter(log => log.action === 'processed').length,
        failedTransactions: logs.filter(log => log.action === 'failed').length,
        totalAmount: logs.reduce((sum, log) => sum + log.amount, 0),
        providerBreakdown: this.getProviderBreakdown(logs),
        logs,
      };
    } catch (error) {
      this.logger.error('Failed to generate payment audit report:', error);
      throw error;
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters: AuditLogFilters): Promise<AuditLog[]> {
    try {
      let query: any = this.firebaseConfig.getFirestore().collection(FIRESTORE_COLLECTIONS.AUDIT_LOGS);

      if (filters.startDate) {
        query = query.where('timestamp', '>=', filters.startDate);
      }

      if (filters.endDate) {
        query = query.where('timestamp', '<=', filters.endDate);
      }

      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }

      if (filters.type) {
        query = query.where('type', '==', filters.type);
      }

      if (filters.action) {
        query = query.where('action', '==', filters.action);
      }

      if (filters.severity) {
        query = query.where('severity', '==', filters.severity);
      }

      const snapshot = await query.orderBy('timestamp', 'desc').limit(100).get();
      
      return snapshot.docs.map(doc => 
        firestoreDocumentToAuditLog(doc.data() as any)
      );
    } catch (error) {
      this.logger.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Sanitize third-party responses to remove sensitive data
   */
  private sanitizeResponse(response: any): any {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const sanitized = { ...response };
    
    // Remove sensitive fields
    delete sanitized.client_secret;
    delete sanitized.payment_method_details?.card?.fingerprint;
    delete sanitized.billing_details;
    delete sanitized.customer;
    delete sanitized.source;
    
    // Sanitize nested objects
    if (sanitized.payment_method_details?.card) {
      const card = sanitized.payment_method_details.card;
      sanitized.payment_method_details.card = {
        brand: card.brand,
        last4: card.last4,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
      };
    }
    
    return sanitized;
  }

  /**
   * Get provider breakdown for audit report
   */
  private getProviderBreakdown(logs: PaymentTransactionLog[]): Record<string, number> {
    return logs.reduce((breakdown, log) => {
      breakdown[log.provider] = (breakdown[log.provider] || 0) + 1;
      return breakdown;
    }, {} as Record<string, number>);
  }

  /**
   * Log to external monitoring service (placeholder for production)
   */
  private async logToExternalService(logEntry: any): Promise<void> {
    // Integration with external logging service (e.g., Sentry, LogRocket)
    // This ensures payment logs are also available outside Firebase
    this.logger.debug('External logging would be implemented here for production');
  }
}