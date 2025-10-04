import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
// PayPal SDK types (simplified for this implementation)
interface PayPalClient {
  // Placeholder for PayPal client
}

interface PayPalCaptureResponse {
  result: {
    id: string;
    status: string;
  };
}
import { 
  Payment, 
  CreatePaymentDto, 
  PaymentResult, 
  PaymentStatus,
  PaymentMethod 
} from '@home-management/types';
// Temporary inline utils until @home-management/utils is properly built
const FIRESTORE_COLLECTIONS = {
  PAYMENTS: 'payments',
  USERS: 'users',
} as const;

const paymentToFirestoreDocument = (payment: Payment) => {
  const doc: any = {
    id: payment.id,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description,
    status: payment.status,
    dueDate: payment.dueDate,
  };
  
  // Only include optional fields if they have values (not undefined)
  if (payment.paidDate !== undefined) {
    doc.paidDate = payment.paidDate;
  }
  if (payment.paymentMethod !== undefined) {
    doc.paymentMethod = payment.paymentMethod;
  }
  if (payment.transactionId !== undefined) {
    doc.transactionId = payment.transactionId;
  }
  
  return doc;
};

const firestoreDocumentToPayment = (doc: any): Payment => {
  return {
    id: doc.id,
    userId: doc.userId,
    amount: doc.amount,
    currency: doc.currency,
    description: doc.description,
    status: doc.status,
    dueDate: doc.dueDate?.toDate ? doc.dueDate.toDate() : (doc.dueDate ? new Date(doc.dueDate) : new Date()),
    paidDate: doc.paidDate ? (doc.paidDate?.toDate ? doc.paidDate.toDate() : new Date(doc.paidDate)) : undefined,
    paymentMethod: doc.paymentMethod || undefined,
    transactionId: doc.transactionId || undefined,
    createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate() : new Date(doc.createdAt || Date.now()),
    updatedAt: doc.updatedAt?.toDate ? doc.updatedAt.toDate() : new Date(doc.updatedAt || Date.now()),
  };
};
import { FirebaseConfigService } from '../../config/firebase.config';
import { PaymentAuditService } from './payment-audit.service';
import { FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;
  private readonly paypalClient: PayPalClient;

  constructor(
    private readonly firebaseConfig: FirebaseConfigService,
    private readonly configService: ConfigService,
    private readonly auditService: PaymentAuditService,
  ) {
    // Initialize Stripe
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2022-11-15',
    });

    // Initialize PayPal (simplified implementation)
    this.paypalClient = {} as PayPalClient;
  }

  /**
   * Create a new payment record
   */
  async createPayment(paymentData: CreatePaymentDto): Promise<Payment> {
    try {
      const payment: Payment = {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...paymentData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const firestoreDoc = {
        ...paymentToFirestoreDocument(payment),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .doc(payment.id)
        .set(firestoreDoc);

      // Log payment creation
      await this.auditService.logPaymentEvent({
        type: 'payment_created',
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        provider: 'system',
        ipAddress: 'system',
        userAgent: 'system',
      });

      this.logger.log(`Payment created: ${payment.id}`);
      return payment;
    } catch (error) {
      this.logger.error('Failed to create payment:', error);
      throw new InternalServerErrorException('Failed to create payment');
    }
  }

  /**
   * Process payment using specified method
   */
  async processPayment(
    paymentId: string, 
    paymentMethod: PaymentMethod,
    paymentDetails: any,
    ipAddress: string,
    userAgent: string,
  ): Promise<PaymentResult> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.status !== 'pending') {
        throw new BadRequestException('Payment is not in pending status');
      }

      let result: PaymentResult;

      switch (paymentMethod) {
        case 'stripe':
          result = await this.processStripePayment(payment, paymentDetails, ipAddress, userAgent);
          break;
        case 'paypal':
          result = await this.processPayPalPayment(payment, paymentDetails, ipAddress, userAgent);
          break;
        default:
          throw new BadRequestException('Unsupported payment method');
      }

      // Update payment status
      const newStatus: PaymentStatus = result.success ? 'paid' : 'pending';
      await this.updatePaymentStatus(paymentId, newStatus, result.transactionId);

      return result;
    } catch (error) {
      this.logger.error('Failed to process payment:', error);
      
      // Log failed payment attempt
      await this.auditService.logPaymentEvent({
        type: 'payment_failed',
        paymentId,
        userId: 'unknown',
        amount: 0,
        provider: paymentMethod,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process payment');
    }
  }

  /**
   * Process Stripe payment
   */
  private async processStripePayment(
    payment: Payment,
    paymentDetails: { paymentMethodId: string },
    ipAddress: string,
    userAgent: string,
  ): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency.toLowerCase(),
        payment_method: paymentDetails.paymentMethodId,
        confirm: true,
        description: payment.description,
        metadata: {
          paymentId: payment.id,
          userId: payment.userId,
        },
        return_url: `${this.configService.get('CLIENT_URL')}/payments/success`,
      });

      const success = paymentIntent.status === 'succeeded';

      // Log the transaction
      await this.auditService.logThirdPartyResponse(
        payment.id,
        'stripe',
        paymentIntent,
        success,
        payment.userId,
        payment.amount,
        payment.currency,
        ipAddress,
        userAgent,
      );

      return {
        success,
        transactionId: paymentIntent.id,
        error: success ? undefined : `Payment failed with status: ${paymentIntent.status}`,
      };
    } catch (error) {
      this.logger.error('Stripe payment failed:', error);

      // Log the failed transaction
      await this.auditService.logThirdPartyResponse(
        payment.id,
        'stripe',
        error,
        false,
        payment.userId,
        payment.amount,
        payment.currency,
        ipAddress,
        userAgent,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stripe payment failed',
      };
    }
  }

  /**
   * Process PayPal payment (simplified implementation)
   */
  private async processPayPalPayment(
    payment: Payment,
    paymentDetails: { orderId: string },
    ipAddress: string,
    userAgent: string,
  ): Promise<PaymentResult> {
    try {
      // Simplified PayPal payment processing
      // In a real implementation, you would use the PayPal SDK to capture the order
      const mockCaptureResponse: PayPalCaptureResponse = {
        result: {
          id: paymentDetails.orderId,
          status: 'COMPLETED', // Simulate successful payment
        },
      };

      const success = mockCaptureResponse.result.status === 'COMPLETED';
      const transactionId = mockCaptureResponse.result.id;

      // Log the transaction
      await this.auditService.logThirdPartyResponse(
        payment.id,
        'paypal',
        mockCaptureResponse.result,
        success,
        payment.userId,
        payment.amount,
        payment.currency,
        ipAddress,
        userAgent,
      );

      this.logger.log(`PayPal payment processed: ${payment.id} -> ${success ? 'SUCCESS' : 'FAILED'}`);

      return {
        success,
        transactionId,
        error: success ? undefined : `PayPal payment failed with status: ${mockCaptureResponse.result.status}`,
      };
    } catch (error) {
      this.logger.error('PayPal payment failed:', error);

      // Log the failed transaction
      await this.auditService.logThirdPartyResponse(
        payment.id,
        'paypal',
        error,
        false,
        payment.userId,
        payment.amount,
        payment.currency,
        ipAddress,
        userAgent,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'PayPal payment failed',
      };
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    try {
      const doc = await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .doc(paymentId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return firestoreDocumentToPayment(doc.data() as any);
    } catch (error) {
      this.logger.error('Failed to get payment by ID:', error);
      throw new InternalServerErrorException('Failed to retrieve payment');
    }
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string): Promise<Payment[]> {
    try {
      const snapshot = await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => firestoreDocumentToPayment(doc.data() as any));
    } catch (error) {
      this.logger.error('Failed to get payment history:', error);
      throw new InternalServerErrorException('Failed to retrieve payment history');
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string, 
    status: PaymentStatus, 
    transactionId?: string,
  ): Promise<Payment> {
    try {
      const updateData: any = {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (status === 'paid') {
        updateData.paidDate = FieldValue.serverTimestamp();
      }

      if (transactionId) {
        updateData.transactionId = transactionId;
      }

      await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .doc(paymentId)
        .update(updateData);

      const updatedPayment = await this.getPaymentById(paymentId);
      
      if (updatedPayment) {
        // Log status update
        await this.auditService.logPaymentEvent({
          type: status === 'paid' ? 'payment_processed' : 'payment_failed',
          paymentId,
          userId: updatedPayment.userId,
          amount: updatedPayment.amount,
          provider: 'system',
          providerTransactionId: transactionId,
          ipAddress: 'system',
          userAgent: 'system',
        });
      }

      this.logger.log(`Payment status updated: ${paymentId} -> ${status}`);
      return updatedPayment!;
    } catch (error) {
      this.logger.error('Failed to update payment status:', error);
      throw new InternalServerErrorException('Failed to update payment status');
    }
  }

  /**
   * Get all payments (admin only)
   */
  async getAllPayments(): Promise<Payment[]> {
    try {
      const snapshot = await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => firestoreDocumentToPayment(doc.data() as any));
    } catch (error) {
      this.logger.error('Failed to get all payments:', error);
      throw new InternalServerErrorException('Failed to retrieve payments');
    }
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status: PaymentStatus): Promise<Payment[]> {
    try {
      const snapshot = await this.firebaseConfig.getFirestore()
        .collection(FIRESTORE_COLLECTIONS.PAYMENTS)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => firestoreDocumentToPayment(doc.data() as any));
    } catch (error) {
      this.logger.error('Failed to get payments by status:', error);
      throw new InternalServerErrorException('Failed to retrieve payments by status');
    }
  }
}