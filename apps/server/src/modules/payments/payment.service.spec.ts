import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentAuditService } from './payment-audit.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { Payment, CreatePaymentDto, PaymentMethod } from '@home-management/types';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
    },
  }));
});

// PayPal SDK is simplified in the implementation, no mocking needed

describe('PaymentService', () => {
  let service: PaymentService;
  let firebaseConfig: jest.Mocked<FirebaseConfigService>;
  let auditService: jest.Mocked<PaymentAuditService>;
  let configService: jest.Mocked<ConfigService>;

  const mockFirestore = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: FirebaseConfigService,
          useValue: {
            getFirestore: jest.fn().mockReturnValue(mockFirestore),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                STRIPE_SECRET_KEY: 'sk_test_mock',
                PAYPAL_CLIENT_ID: 'mock_client_id',
                PAYPAL_CLIENT_SECRET: 'mock_client_secret',
                NODE_ENV: 'test',
                CLIENT_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PaymentAuditService,
          useValue: {
            logPaymentEvent: jest.fn(),
            logThirdPartyResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    firebaseConfig = module.get(FirebaseConfigService);
    auditService = module.get(PaymentAuditService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const createPaymentDto: CreatePaymentDto = {
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        dueDate: new Date('2024-01-31'),
      };

      mockFirestore.set.mockResolvedValue(undefined);

      const result = await service.createPayment(createPaymentDto);

      expect(result).toMatchObject({
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        status: 'pending',
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(mockFirestore.collection).toHaveBeenCalledWith('payments');
      expect(mockFirestore.set).toHaveBeenCalled();
      expect(auditService.logPaymentEvent).toHaveBeenCalledWith({
        type: 'payment_created',
        paymentId: result.id,
        userId: 'user123',
        amount: 100.50,
        provider: 'system',
        ipAddress: 'system',
        userAgent: 'system',
      });
    });

    it('should handle creation errors', async () => {
      const createPaymentDto: CreatePaymentDto = {
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        dueDate: new Date('2024-01-31'),
      };

      mockFirestore.set.mockRejectedValue(new Error('Firestore error'));

      await expect(service.createPayment(createPaymentDto)).rejects.toThrow('Failed to create payment');
    });
  });

  describe('getPaymentById', () => {
    it('should return payment when found', async () => {
      const mockPaymentDoc = {
        id: 'payment123',
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        status: 'pending',
        dueDate: { toDate: () => new Date('2024-01-31') },
        createdAt: { toDate: () => new Date('2024-01-01') },
        updatedAt: { toDate: () => new Date('2024-01-01') },
      };

      mockFirestore.get.mockResolvedValue({
        exists: true,
        data: () => mockPaymentDoc,
      });

      const result = await service.getPaymentById('payment123');

      expect(result).toMatchObject({
        id: 'payment123',
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        status: 'pending',
      });
      expect(mockFirestore.collection).toHaveBeenCalledWith('payments');
      expect(mockFirestore.doc).toHaveBeenCalledWith('payment123');
    });

    it('should return null when payment not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      const result = await service.getPaymentById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPaymentHistory', () => {
    it('should return user payment history', async () => {
      const mockPayments = [
        {
          id: 'payment1',
          userId: 'user123',
          amount: 100,
          currency: 'USD',
          description: 'Fee 1',
          status: 'paid',
          dueDate: { toDate: () => new Date('2024-01-31') },
          createdAt: { toDate: () => new Date('2024-01-01') },
          updatedAt: { toDate: () => new Date('2024-01-01') },
        },
        {
          id: 'payment2',
          userId: 'user123',
          amount: 150,
          currency: 'USD',
          description: 'Fee 2',
          status: 'pending',
          dueDate: { toDate: () => new Date('2024-02-28') },
          createdAt: { toDate: () => new Date('2024-02-01') },
          updatedAt: { toDate: () => new Date('2024-02-01') },
        },
      ];

      mockFirestore.get.mockResolvedValue({
        docs: mockPayments.map(payment => ({
          data: () => payment,
        })),
      });

      const result = await service.getPaymentHistory('user123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('payment1');
      expect(result[1].id).toBe('payment2');
      expect(mockFirestore.where).toHaveBeenCalledWith('userId', '==', 'user123');
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status successfully', async () => {
      const mockPaymentDoc = {
        id: 'payment123',
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        status: 'paid',
        dueDate: { toDate: () => new Date('2024-01-31') },
        paidDate: { toDate: () => new Date('2024-01-15') },
        transactionId: 'txn_123',
        createdAt: { toDate: () => new Date('2024-01-01') },
        updatedAt: { toDate: () => new Date('2024-01-15') },
      };

      mockFirestore.update.mockResolvedValue(undefined);
      mockFirestore.get.mockResolvedValue({
        exists: true,
        data: () => mockPaymentDoc,
      });

      const result = await service.updatePaymentStatus('payment123', 'paid', 'txn_123');

      expect(result.status).toBe('paid');
      expect(result.transactionId).toBe('txn_123');
      expect(mockFirestore.update).toHaveBeenCalled();
      expect(auditService.logPaymentEvent).toHaveBeenCalledWith({
        type: 'payment_processed',
        paymentId: 'payment123',
        userId: 'user123',
        amount: 100.50,
        provider: 'system',
        providerTransactionId: 'txn_123',
        ipAddress: 'system',
        userAgent: 'system',
      });
    });
  });

  describe('processPayment', () => {
    const mockPayment: Payment = {
      id: 'payment123',
      userId: 'user123',
      amount: 100.50,
      currency: 'USD',
      description: 'Monthly maintenance fee',
      status: 'pending',
      dueDate: new Date('2024-01-31'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    beforeEach(() => {
      jest.spyOn(service, 'getPaymentById').mockResolvedValue(mockPayment);
      jest.spyOn(service, 'updatePaymentStatus').mockResolvedValue({
        ...mockPayment,
        status: 'paid',
        transactionId: 'txn_123',
      });
    });

    it('should process Stripe payment successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 10050, // in cents
        currency: 'usd',
      };

      // Mock Stripe
      const Stripe = require('stripe');
      const mockStripe = new Stripe();
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Mock the stripe instance on the service
      (service as any).stripe = mockStripe;

      const result = await service.processPayment(
        'payment123',
        'stripe' as PaymentMethod,
        { paymentMethodId: 'pm_123' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('pi_123');
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'stripe',
        mockPaymentIntent,
        true,
        'user123',
        100.50,
        'USD',
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should handle Stripe payment failure', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'requires_payment_method',
        amount: 10050,
        currency: 'usd',
      };

      const Stripe = require('stripe');
      const mockStripe = new Stripe();
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Mock the stripe instance on the service
      (service as any).stripe = mockStripe;

      const result = await service.processPayment(
        'payment123',
        'stripe' as PaymentMethod,
        { paymentMethodId: 'pm_123' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment failed with status');
    });

    it('should process PayPal payment successfully', async () => {
      const result = await service.processPayment(
        'payment123',
        'paypal' as PaymentMethod,
        { orderId: 'order_123' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('order_123');
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'paypal',
        expect.objectContaining({
          id: 'order_123',
          status: 'COMPLETED',
        }),
        true,
        'user123',
        100.50,
        'USD',
        '127.0.0.1',
        'test-agent',
      );
    });

    it('should handle payment not found', async () => {
      jest.spyOn(service, 'getPaymentById').mockResolvedValue(null);

      await expect(
        service.processPayment(
          'nonexistent',
          'stripe' as PaymentMethod,
          { paymentMethodId: 'pm_123' },
          '127.0.0.1',
          'test-agent',
        ),
      ).rejects.toThrow('Payment not found');
    });

    it('should handle payment not in pending status', async () => {
      jest.spyOn(service, 'getPaymentById').mockResolvedValue({
        ...mockPayment,
        status: 'paid',
      });

      await expect(
        service.processPayment(
          'payment123',
          'stripe' as PaymentMethod,
          { paymentMethodId: 'pm_123' },
          '127.0.0.1',
          'test-agent',
        ),
      ).rejects.toThrow('Payment is not in pending status');
    });
  });
});