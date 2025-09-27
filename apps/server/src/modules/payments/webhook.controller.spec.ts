import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentAuditService } from './payment-audit.service';

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('WebhookController', () => {
  let controller: WebhookController;
  let paymentService: jest.Mocked<PaymentService>;
  let auditService: jest.Mocked<PaymentAuditService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRequest = {
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    get: jest.fn().mockReturnValue('stripe-webhook/1.0'),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            updatePaymentStatus: jest.fn(),
          },
        },
        {
          provide: PaymentAuditService,
          useValue: {
            logThirdPartyResponse: jest.fn(),
            logPaymentEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                STRIPE_SECRET_KEY: 'sk_test_mock',
                STRIPE_WEBHOOK_SECRET: 'whsec_test_mock',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    paymentService = module.get(PaymentService);
    auditService = module.get(PaymentAuditService);
    configService = module.get(ConfigService);
  });

  const mockStripeWebhook = (event: any) => {
    const Stripe = require('stripe');
    const mockStripe = new Stripe();
    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    (controller as any).stripe = mockStripe;
    return mockStripe;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleStripeWebhook', () => {
    const mockRawBody = Buffer.from('test-body');
    const mockSignature = 'test-signature';

    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            amount: 10050,
            currency: 'usd',
            metadata: {
              paymentId: 'payment123',
              userId: 'user123',
            },
          },
        },
      };

      mockStripeWebhook(mockEvent);

      paymentService.updatePaymentStatus.mockResolvedValue({} as any);
      auditService.logThirdPartyResponse.mockResolvedValue();

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'payment123',
        'paid',
        'pi_123',
      );
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'stripe',
        mockEvent.data.object,
        true,
        'user123',
        100.50,
        'usd',
        '127.0.0.1',
        'stripe-webhook/1.0',
      );
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123',
            status: 'requires_payment_method',
            amount: 10050,
            currency: 'usd',
            metadata: {
              paymentId: 'payment123',
              userId: 'user123',
            },
          },
        },
      };

      mockStripeWebhook(mockEvent);
      auditService.logThirdPartyResponse.mockResolvedValue();

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'stripe',
        mockEvent.data.object,
        false,
        'user123',
        100.50,
        'usd',
        '127.0.0.1',
        'stripe-webhook/1.0',
      );
    });

    it('should handle payment_intent.canceled event', async () => {
      const mockEvent = {
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_123',
            status: 'canceled',
            amount: 10050,
            currency: 'usd',
            metadata: {
              paymentId: 'payment123',
              userId: 'user123',
            },
          },
        },
      };

      mockStripeWebhook(mockEvent);

      paymentService.updatePaymentStatus.mockResolvedValue({} as any);
      auditService.logThirdPartyResponse.mockResolvedValue();

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'payment123',
        'cancelled',
      );
    });

    it('should handle charge.dispute.created event', async () => {
      const mockEvent = {
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_123',
            charge: 'ch_123',
            amount: 10050,
            reason: 'fraudulent',
          },
        },
      };

      mockStripeWebhook(mockEvent);

      auditService.logPaymentEvent.mockResolvedValue();

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(auditService.logPaymentEvent).toHaveBeenCalledWith({
        type: 'payment_failed',
        paymentId: 'ch_123',
        userId: 'unknown',
        amount: 100.50,
        provider: 'stripe',
        providerTransactionId: 'dp_123',
        errorMessage: 'Charge disputed: fraudulent',
        ipAddress: '127.0.0.1',
        userAgent: 'stripe-webhook/1.0',
      });
    });

    it('should handle unhandled event types', async () => {
      const mockEvent = {
        type: 'customer.created',
        data: {
          object: {},
        },
      };

      mockStripeWebhook(mockEvent);

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
    });

    it('should throw error when webhook secret is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(
        controller.handleStripeWebhook(mockRawBody, mockSignature, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when signature verification fails', async () => {
      const Stripe = require('stripe');
      const mockStripe = new Stripe();
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      (controller as any).stripe = mockStripe;

      await expect(
        controller.handleStripeWebhook(mockRawBody, mockSignature, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle events without paymentId in metadata', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded',
            amount: 10050,
            currency: 'usd',
            metadata: {}, // No paymentId
          },
        },
      };

      mockStripeWebhook(mockEvent);

      const result = await controller.handleStripeWebhook(
        mockRawBody,
        mockSignature,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe('handlePayPalWebhook', () => {
    const mockHeaders = {
      'paypal-transmission-id': 'test-id',
      'paypal-cert-id': 'test-cert',
      'paypal-transmission-sig': 'test-sig',
    };

    it('should handle PAYMENT.CAPTURE.COMPLETED event', async () => {
      const mockBody = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'capture_123',
          custom_id: 'payment123',
          amount: {
            value: '100.50',
            currency_code: 'USD',
          },
        },
      };

      paymentService.updatePaymentStatus.mockResolvedValue({} as any);
      auditService.logThirdPartyResponse.mockResolvedValue();

      const result = await controller.handlePayPalWebhook(
        mockBody,
        mockHeaders,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
        'payment123',
        'paid',
        'capture_123',
      );
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'paypal',
        mockBody.resource,
        true,
        'unknown',
        100.50,
        'USD',
        '127.0.0.1',
        'stripe-webhook/1.0',
      );
    });

    it('should handle PAYMENT.CAPTURE.DENIED event', async () => {
      const mockBody = {
        event_type: 'PAYMENT.CAPTURE.DENIED',
        resource: {
          id: 'capture_123',
          custom_id: 'payment123',
          amount: {
            value: '100.50',
            currency_code: 'USD',
          },
        },
      };

      auditService.logThirdPartyResponse.mockResolvedValue();

      const result = await controller.handlePayPalWebhook(
        mockBody,
        mockHeaders,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(auditService.logThirdPartyResponse).toHaveBeenCalledWith(
        'payment123',
        'paypal',
        mockBody.resource,
        false,
        'unknown',
        100.50,
        'USD',
        '127.0.0.1',
        'stripe-webhook/1.0',
      );
    });

    it('should handle PAYMENT.CAPTURE.REFUNDED event', async () => {
      const mockBody = {
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: {
          id: 'refund_123',
          custom_id: 'payment123',
          amount: {
            value: '100.50',
            currency_code: 'USD',
          },
        },
      };

      auditService.logPaymentEvent.mockResolvedValue();

      const result = await controller.handlePayPalWebhook(
        mockBody,
        mockHeaders,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(auditService.logPaymentEvent).toHaveBeenCalledWith({
        type: 'payment_refunded',
        paymentId: 'payment123',
        userId: 'unknown',
        amount: 100.50,
        provider: 'paypal',
        providerTransactionId: 'refund_123',
        ipAddress: '127.0.0.1',
        userAgent: 'stripe-webhook/1.0',
      });
    });

    it('should handle unhandled PayPal event types', async () => {
      const mockBody = {
        event_type: 'BILLING.SUBSCRIPTION.CREATED',
        resource: {},
      };

      const result = await controller.handlePayPalWebhook(
        mockBody,
        mockHeaders,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle events without custom_id', async () => {
      const mockBody = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'capture_123',
          amount: {
            value: '100.50',
            currency_code: 'USD',
          },
        },
      };

      const result = await controller.handlePayPalWebhook(
        mockBody,
        mockHeaders,
        mockRequest,
      );

      expect(result).toEqual({ received: true });
      expect(paymentService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should throw error for invalid PayPal webhook', async () => {
      const mockBody = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {},
      };

      const invalidHeaders = {}; // Missing required headers

      await expect(
        controller.handlePayPalWebhook(mockBody, invalidHeaders, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });
});