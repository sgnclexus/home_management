import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentAuditService } from './payment-audit.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Payment, CreatePaymentDto, PaymentMethod } from '@home-management/types';
import { BadRequestException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<PaymentService>;
  let auditService: jest.Mocked<PaymentAuditService>;

  const mockUser = {
    uid: 'user123',
    email: 'test@example.com',
    role: 'resident',
  };

  const mockAdminUser = {
    uid: 'admin123',
    email: 'admin@example.com',
    role: 'admin',
  };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            createPayment: jest.fn(),
            processPayment: jest.fn(),
            getPaymentById: jest.fn(),
            getPaymentHistory: jest.fn(),
            getAllPayments: jest.fn(),
            getPaymentsByStatus: jest.fn(),
            updatePaymentStatus: jest.fn(),
          },
        },
        {
          provide: PaymentAuditService,
          useValue: {
            getPaymentAuditReport: jest.fn(),
            getAuditLogs: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get(PaymentService);
    auditService = module.get(PaymentAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create a payment successfully', async () => {
      const createPaymentDto = {
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        dueDate: '2024-01-31T00:00:00.000Z',
      };

      paymentService.createPayment.mockResolvedValue(mockPayment);

      const result = await controller.createPayment(createPaymentDto, mockAdminUser);

      expect(result).toEqual(mockPayment);
      expect(paymentService.createPayment).toHaveBeenCalledWith({
        ...createPaymentDto,
        dueDate: new Date(createPaymentDto.dueDate),
      });
    });
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      const processPaymentDto = {
        paymentMethod: 'stripe' as PaymentMethod,
        paymentDetails: { paymentMethodId: 'pm_123' },
      };

      const mockRequest = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent'),
      } as any;

      const mockResult = {
        success: true,
        transactionId: 'txn_123',
      };

      paymentService.processPayment.mockResolvedValue(mockResult);

      const result = await controller.processPayment(
        'payment123',
        processPaymentDto,
        mockRequest,
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(paymentService.processPayment).toHaveBeenCalledWith(
        'payment123',
        'stripe',
        { paymentMethodId: 'pm_123' },
        '127.0.0.1',
        'test-agent',
      );
    });
  });

  describe('getPayment', () => {
    it('should return payment for owner', async () => {
      paymentService.getPaymentById.mockResolvedValue(mockPayment);

      const result = await controller.getPayment('payment123', mockUser);

      expect(result).toEqual(mockPayment);
      expect(paymentService.getPaymentById).toHaveBeenCalledWith('payment123');
    });

    it('should return payment for admin', async () => {
      const otherUserPayment = { ...mockPayment, userId: 'other123' };
      paymentService.getPaymentById.mockResolvedValue(otherUserPayment);

      const result = await controller.getPayment('payment123', mockAdminUser);

      expect(result).toEqual(otherUserPayment);
    });

    it('should throw error when payment not found', async () => {
      paymentService.getPaymentById.mockResolvedValue(null);

      await expect(controller.getPayment('nonexistent', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when user tries to access other user payment', async () => {
      const otherUserPayment = { ...mockPayment, userId: 'other123' };
      paymentService.getPaymentById.mockResolvedValue(otherUserPayment);

      await expect(controller.getPayment('payment123', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserPaymentHistory', () => {
    it('should return user payment history', async () => {
      const mockPayments = [mockPayment];
      paymentService.getPaymentHistory.mockResolvedValue(mockPayments);

      const result = await controller.getUserPaymentHistory(mockUser);

      expect(result).toEqual(mockPayments);
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('user123');
    });
  });

  describe('getPaymentHistoryByUser', () => {
    it('should return payment history for specific user', async () => {
      const mockPayments = [mockPayment];
      paymentService.getPaymentHistory.mockResolvedValue(mockPayments);

      const result = await controller.getPaymentHistoryByUser('user123');

      expect(result).toEqual(mockPayments);
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('user123');
    });
  });

  describe('getAllPayments', () => {
    it('should return all payments', async () => {
      const mockPayments = [mockPayment];
      paymentService.getAllPayments.mockResolvedValue(mockPayments);

      const result = await controller.getAllPayments();

      expect(result).toEqual(mockPayments);
      expect(paymentService.getAllPayments).toHaveBeenCalled();
    });
  });

  describe('getPaymentsByStatus', () => {
    it('should return payments by status', async () => {
      const mockPayments = [mockPayment];
      paymentService.getPaymentsByStatus.mockResolvedValue(mockPayments);

      const result = await controller.getPaymentsByStatus('pending');

      expect(result).toEqual(mockPayments);
      expect(paymentService.getPaymentsByStatus).toHaveBeenCalledWith('pending');
    });

    it('should throw error for invalid status', async () => {
      await expect(controller.getPaymentsByStatus('invalid' as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const updateStatusDto = {
        status: 'paid' as const,
        transactionId: 'txn_123',
      };

      const updatedPayment = { ...mockPayment, status: 'paid' as const, transactionId: 'txn_123' };
      paymentService.updatePaymentStatus.mockResolvedValue(updatedPayment);

      const result = await controller.updatePaymentStatus('payment123', updateStatusDto);

      expect(result).toEqual(updatedPayment);
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'payment123',
        'paid',
        'txn_123',
      );
    });
  });

  describe('getPaymentAuditReport', () => {
    it('should return payment audit report', async () => {
      const mockReport = {
        totalTransactions: 10,
        successfulTransactions: 8,
        failedTransactions: 2,
        totalAmount: 1000,
        providerBreakdown: { stripe: 6, paypal: 4 },
        logs: [],
      };

      auditService.getPaymentAuditReport.mockResolvedValue(mockReport);

      const result = await controller.getPaymentAuditReport(
        '2024-01-01',
        '2024-01-31',
        'user123',
      );

      expect(result).toEqual(mockReport);
      expect(auditService.getPaymentAuditReport).toHaveBeenCalledWith(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'user123',
      );
    });

    it('should use default date range when not provided', async () => {
      const mockReport = {
        totalTransactions: 10,
        successfulTransactions: 8,
        failedTransactions: 2,
        totalAmount: 1000,
        providerBreakdown: { stripe: 6, paypal: 4 },
        logs: [],
      };

      auditService.getPaymentAuditReport.mockResolvedValue(mockReport);

      await controller.getPaymentAuditReport();

      expect(auditService.getPaymentAuditReport).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        undefined,
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with filters', async () => {
      const mockLogs = [];
      auditService.getAuditLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs(
        '2024-01-01',
        '2024-01-31',
        'user123',
        'payment',
        'payment_created',
        'info',
      );

      expect(result).toEqual(mockLogs);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        userId: 'user123',
        type: 'payment',
        action: 'payment_created',
        severity: 'info',
      });
    });

    it('should return audit logs without filters', async () => {
      const mockLogs = [];
      auditService.getAuditLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs();

      expect(result).toEqual(mockLogs);
      expect(auditService.getAuditLogs).toHaveBeenCalledWith({});
    });
  });
});