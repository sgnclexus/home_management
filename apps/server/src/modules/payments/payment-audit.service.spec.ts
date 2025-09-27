import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentAuditService } from './payment-audit.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { 
  PaymentTransactionLog, 
  PaymentAuditEvent, 
  AuditLogFilters,
  PaymentAuditReport 
} from '@home-management/types';

// Mock Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  set: jest.fn().mockResolvedValue(undefined),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({
    docs: [
      {
        data: () => ({
          id: 'log1',
          paymentId: 'payment1',
          userId: 'user1',
          action: 'processed',
          provider: 'stripe',
          providerResponse: { status: 'succeeded' },
          amount: 100,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: { toDate: () => new Date('2023-01-01') },
        }),
      },
      {
        data: () => ({
          id: 'log2',
          paymentId: 'payment2',
          userId: 'user2',
          action: 'failed',
          provider: 'paypal',
          providerResponse: { error: 'payment failed' },
          amount: 200,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: { toDate: () => new Date('2023-01-02') },
        }),
      },
    ],
  }),
};

// Mock FieldValue
const mockFieldValue = {
  serverTimestamp: jest.fn().mockReturnValue('SERVER_TIMESTAMP'),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config = {
      NODE_ENV: 'test',
      npm_package_version: '1.0.0',
    };
    return config[key] || defaultValue;
  }),
};

// Mock FirebaseConfigService
const mockFirebaseConfigService = {
  getFirestore: jest.fn().mockReturnValue(mockFirestore),
};

describe('PaymentAuditService', () => {
  let service: PaymentAuditService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAuditService,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseConfigService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentAuditService>(PaymentAuditService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logPaymentTransaction', () => {
    it('should log payment transaction successfully', async () => {
      const transactionData: PaymentTransactionLog = {
        id: 'log123',
        paymentId: 'payment123',
        userId: 'user123',
        action: 'processed',
        provider: 'stripe',
        providerTransactionId: 'pi_123456',
        providerResponse: { status: 'succeeded' },
        amount: 100.50,
        currency: 'USD',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.logPaymentTransaction(transactionData);

      expect(mockFirestore.collection).toHaveBeenCalledWith('payment_transaction_logs');
      expect(mockFirestore.doc).toHaveBeenCalledWith('log123');
      expect(mockFirestore.set).toHaveBeenCalled();
    });

    it('should handle logging errors gracefully', async () => {
      const transactionData: PaymentTransactionLog = {
        id: 'log123',
        paymentId: 'payment123',
        userId: 'user123',
        action: 'processed',
        provider: 'stripe',
        providerResponse: { status: 'succeeded' },
        amount: 100.50,
        currency: 'USD',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFirestore.set.mockRejectedValueOnce(new Error('Firestore error'));

      // Should not throw error
      await expect(service.logPaymentTransaction(transactionData)).resolves.toBeUndefined();
    });
  });

  describe('logThirdPartyResponse', () => {
    it('should log third-party response successfully', async () => {
      const response = {
        id: 'pi_123456',
        status: 'succeeded',
        client_secret: 'secret_key', // Should be sanitized
        payment_method_details: {
          card: {
            brand: 'visa',
            last4: '4242',
            fingerprint: 'sensitive_data', // Should be sanitized
          },
        },
      };

      await service.logThirdPartyResponse(
        'payment123',
        'stripe',
        response,
        true,
        'user123',
        100.50,
        'USD',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith('payment_transaction_logs');
      expect(mockFirestore.set).toHaveBeenCalled();
    });

    it('should log failed third-party response', async () => {
      const response = {
        error: {
          code: 'card_declined',
          message: 'Your card was declined.',
        },
      };

      await service.logThirdPartyResponse(
        'payment123',
        'stripe',
        response,
        false,
        'user123',
        100.50,
        'USD',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith('payment_transaction_logs');
      expect(mockFirestore.set).toHaveBeenCalled();
    });
  });

  describe('logPaymentEvent', () => {
    it('should log payment audit event successfully', async () => {
      const event: PaymentAuditEvent = {
        type: 'payment_created',
        paymentId: 'payment123',
        userId: 'user123',
        amount: 100.50,
        provider: 'stripe',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await service.logPaymentEvent(event);

      expect(mockFirestore.collection).toHaveBeenCalledWith('audit_logs');
      expect(mockFirestore.set).toHaveBeenCalled();
    });

    it('should set error severity for failed events', async () => {
      const event: PaymentAuditEvent = {
        type: 'payment_failed',
        paymentId: 'payment123',
        userId: 'user123',
        amount: 100.50,
        provider: 'stripe',
        errorMessage: 'Payment failed',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await service.logPaymentEvent(event);

      expect(mockFirestore.collection).toHaveBeenCalledWith('audit_logs');
      expect(mockFirestore.set).toHaveBeenCalled();
    });
  });

  describe('getPaymentAuditReport', () => {
    it('should generate payment audit report successfully', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      const result = await service.getPaymentAuditReport(startDate, endDate);

      expect(result).toEqual({
        totalTransactions: 2,
        successfulTransactions: 1,
        failedTransactions: 1,
        totalAmount: 300,
        providerBreakdown: {
          stripe: 1,
          paypal: 1,
        },
        logs: expect.any(Array),
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('payment_transaction_logs');
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '>=', startDate);
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '<=', endDate);
    });

    it('should filter by userId when provided', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      const userId = 'user123';

      await service.getPaymentAuditReport(startDate, endDate, userId);

      expect(mockFirestore.where).toHaveBeenCalledWith('userId', '==', userId);
    });

    it('should handle errors when generating report', async () => {
      mockFirestore.get.mockRejectedValueOnce(new Error('Firestore error'));

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');

      await expect(service.getPaymentAuditReport(startDate, endDate)).rejects.toThrow('Firestore error');
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs with filters', async () => {
      const filters: AuditLogFilters = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        userId: 'user123',
        type: 'payment',
        action: 'payment_created',
        severity: 'info',
      };

      await service.getAuditLogs(filters);

      expect(mockFirestore.collection).toHaveBeenCalledWith('audit_logs');
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '>=', filters.startDate);
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '<=', filters.endDate);
      expect(mockFirestore.where).toHaveBeenCalledWith('userId', '==', filters.userId);
      expect(mockFirestore.where).toHaveBeenCalledWith('type', '==', filters.type);
      expect(mockFirestore.where).toHaveBeenCalledWith('action', '==', filters.action);
      expect(mockFirestore.where).toHaveBeenCalledWith('severity', '==', filters.severity);
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockFirestore.limit).toHaveBeenCalledWith(100);
    });

    it('should get audit logs without filters', async () => {
      const filters: AuditLogFilters = {};

      await service.getAuditLogs(filters);

      expect(mockFirestore.collection).toHaveBeenCalledWith('audit_logs');
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockFirestore.limit).toHaveBeenCalledWith(100);
    });

    it('should handle errors when getting audit logs', async () => {
      mockFirestore.get.mockRejectedValueOnce(new Error('Firestore error'));

      const filters: AuditLogFilters = {};

      await expect(service.getAuditLogs(filters)).rejects.toThrow('Firestore error');
    });
  });

  describe('sanitizeResponse', () => {
    it('should sanitize sensitive data from payment responses', () => {
      const response = {
        id: 'pi_123456',
        status: 'succeeded',
        client_secret: 'secret_key',
        payment_method_details: {
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
            fingerprint: 'sensitive_data',
          },
        },
        billing_details: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        customer: 'cus_123456',
        source: 'src_123456',
      };

      // Access private method through service instance
      const sanitized = (service as any).sanitizeResponse(response);

      expect(sanitized.id).toBe('pi_123456');
      expect(sanitized.status).toBe('succeeded');
      expect(sanitized.client_secret).toBeUndefined();
      expect(sanitized.billing_details).toBeUndefined();
      expect(sanitized.customer).toBeUndefined();
      expect(sanitized.source).toBeUndefined();
      expect(sanitized.payment_method_details.card.fingerprint).toBeUndefined();
      expect(sanitized.payment_method_details.card.brand).toBe('visa');
      expect(sanitized.payment_method_details.card.last4).toBe('4242');
    });

    it('should handle non-object responses', () => {
      const sanitized1 = (service as any).sanitizeResponse(null);
      const sanitized2 = (service as any).sanitizeResponse('string');
      const sanitized3 = (service as any).sanitizeResponse(123);

      expect(sanitized1).toBeNull();
      expect(sanitized2).toBe('string');
      expect(sanitized3).toBe(123);
    });
  });

  describe('getProviderBreakdown', () => {
    it('should calculate provider breakdown correctly', () => {
      const logs: PaymentTransactionLog[] = [
        {
          id: 'log1',
          paymentId: 'payment1',
          userId: 'user1',
          action: 'processed',
          provider: 'stripe',
          providerResponse: { status: 'succeeded' },
          amount: 100,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'log2',
          paymentId: 'payment2',
          userId: 'user2',
          action: 'processed',
          provider: 'stripe',
          providerResponse: { status: 'succeeded' },
          amount: 200,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'log3',
          paymentId: 'payment3',
          userId: 'user3',
          action: 'processed',
          provider: 'paypal',
          providerResponse: { status: 'succeeded' },
          amount: 150,
          currency: 'USD',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const breakdown = (service as any).getProviderBreakdown(logs);

      expect(breakdown).toEqual({
        stripe: 2,
        paypal: 1,
      });
    });
  });
});