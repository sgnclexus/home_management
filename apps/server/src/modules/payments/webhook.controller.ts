import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentService } from './payment.service';
import { PaymentAuditService } from './payment-audit.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: PaymentAuditService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2022-11-15',
    });
  }

  /**
   * Handle Stripe webhooks
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Body() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      this.logger.error('Stripe webhook secret not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error('Stripe webhook signature verification failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    try {
      await this.processStripeWebhookEvent(event, req);
      return { received: true };
    } catch (error) {
      this.logger.error('Failed to process Stripe webhook:', error);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handle PayPal webhooks
   */
  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  async handlePayPalWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received PayPal webhook: ${body.event_type}`);

    try {
      // Verify PayPal webhook (simplified - in production, you should verify the signature)
      const isValid = await this.verifyPayPalWebhook(body, headers);
      
      if (!isValid) {
        throw new BadRequestException('Invalid PayPal webhook');
      }

      await this.processPayPalWebhookEvent(body, req);
      return { received: true };
    } catch (error) {
      this.logger.error('Failed to process PayPal webhook:', error);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Process Stripe webhook events
   */
  private async processStripeWebhookEvent(event: Stripe.Event, req: Request): Promise<void> {
    const ipAddress = req.ip || req.connection.remoteAddress || 'webhook';
    const userAgent = req.get('User-Agent') || 'stripe-webhook';

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleStripePaymentSucceeded(event.data.object as Stripe.PaymentIntent, ipAddress, userAgent);
        break;

      case 'payment_intent.payment_failed':
        await this.handleStripePaymentFailed(event.data.object as Stripe.PaymentIntent, ipAddress, userAgent);
        break;

      case 'payment_intent.canceled':
        await this.handleStripePaymentCanceled(event.data.object as Stripe.PaymentIntent, ipAddress, userAgent);
        break;

      case 'charge.dispute.created':
        await this.handleStripeChargeDispute(event.data.object as Stripe.Dispute, ipAddress, userAgent);
        break;

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  /**
   * Process PayPal webhook events
   */
  private async processPayPalWebhookEvent(body: any, req: Request): Promise<void> {
    const ipAddress = req.ip || req.connection.remoteAddress || 'webhook';
    const userAgent = req.get('User-Agent') || 'paypal-webhook';

    switch (body.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePayPalPaymentCompleted(body, ipAddress, userAgent);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePayPalPaymentDenied(body, ipAddress, userAgent);
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        await this.handlePayPalPaymentRefunded(body, ipAddress, userAgent);
        break;

      default:
        this.logger.log(`Unhandled PayPal event type: ${body.event_type}`);
    }
  }

  /**
   * Handle successful Stripe payment
   */
  private async handleStripePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const paymentId = paymentIntent.metadata?.paymentId;
    
    if (!paymentId) {
      this.logger.warn('Stripe payment succeeded but no paymentId in metadata');
      return;
    }

    try {
      await this.paymentService.updatePaymentStatus(paymentId, 'paid', paymentIntent.id);
      
      // Log the webhook event
      await this.auditService.logThirdPartyResponse(
        paymentId,
        'stripe',
        paymentIntent,
        true,
        paymentIntent.metadata?.userId || 'unknown',
        paymentIntent.amount / 100, // Convert from cents
        paymentIntent.currency,
        ipAddress,
        userAgent,
      );

      this.logger.log(`Stripe payment succeeded: ${paymentId}`);
    } catch (error) {
      this.logger.error('Failed to handle Stripe payment success:', error);
    }
  }

  /**
   * Handle failed Stripe payment
   */
  private async handleStripePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const paymentId = paymentIntent.metadata?.paymentId;
    
    if (!paymentId) {
      this.logger.warn('Stripe payment failed but no paymentId in metadata');
      return;
    }

    try {
      // Log the webhook event
      await this.auditService.logThirdPartyResponse(
        paymentId,
        'stripe',
        paymentIntent,
        false,
        paymentIntent.metadata?.userId || 'unknown',
        paymentIntent.amount / 100, // Convert from cents
        paymentIntent.currency,
        ipAddress,
        userAgent,
      );

      this.logger.log(`Stripe payment failed: ${paymentId}`);
    } catch (error) {
      this.logger.error('Failed to handle Stripe payment failure:', error);
    }
  }

  /**
   * Handle canceled Stripe payment
   */
  private async handleStripePaymentCanceled(
    paymentIntent: Stripe.PaymentIntent,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const paymentId = paymentIntent.metadata?.paymentId;
    
    if (!paymentId) {
      this.logger.warn('Stripe payment canceled but no paymentId in metadata');
      return;
    }

    try {
      await this.paymentService.updatePaymentStatus(paymentId, 'cancelled');
      
      // Log the webhook event
      await this.auditService.logThirdPartyResponse(
        paymentId,
        'stripe',
        paymentIntent,
        false,
        paymentIntent.metadata?.userId || 'unknown',
        paymentIntent.amount / 100, // Convert from cents
        paymentIntent.currency,
        ipAddress,
        userAgent,
      );

      this.logger.log(`Stripe payment canceled: ${paymentId}`);
    } catch (error) {
      this.logger.error('Failed to handle Stripe payment cancellation:', error);
    }
  }

  /**
   * Handle Stripe charge dispute
   */
  private async handleStripeChargeDispute(
    dispute: Stripe.Dispute,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    try {
      // Log the dispute for audit purposes
      await this.auditService.logPaymentEvent({
        type: 'payment_failed',
        paymentId: dispute.charge as string,
        userId: 'unknown',
        amount: dispute.amount / 100,
        provider: 'stripe',
        providerTransactionId: dispute.id,
        errorMessage: `Charge disputed: ${dispute.reason}`,
        ipAddress,
        userAgent,
      });

      this.logger.warn(`Stripe charge disputed: ${dispute.charge}, reason: ${dispute.reason}`);
    } catch (error) {
      this.logger.error('Failed to handle Stripe charge dispute:', error);
    }
  }

  /**
   * Handle completed PayPal payment
   */
  private async handlePayPalPaymentCompleted(
    body: any,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const resource = body.resource;
    const customId = resource.custom_id; // This should contain our paymentId
    
    if (!customId) {
      this.logger.warn('PayPal payment completed but no custom_id');
      return;
    }

    try {
      await this.paymentService.updatePaymentStatus(customId, 'paid', resource.id);
      
      // Log the webhook event
      await this.auditService.logThirdPartyResponse(
        customId,
        'paypal',
        resource,
        true,
        'unknown', // PayPal doesn't provide userId in webhook
        parseFloat(resource.amount.value),
        resource.amount.currency_code,
        ipAddress,
        userAgent,
      );

      this.logger.log(`PayPal payment completed: ${customId}`);
    } catch (error) {
      this.logger.error('Failed to handle PayPal payment completion:', error);
    }
  }

  /**
   * Handle denied PayPal payment
   */
  private async handlePayPalPaymentDenied(
    body: any,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const resource = body.resource;
    const customId = resource.custom_id;
    
    if (!customId) {
      this.logger.warn('PayPal payment denied but no custom_id');
      return;
    }

    try {
      // Log the webhook event
      await this.auditService.logThirdPartyResponse(
        customId,
        'paypal',
        resource,
        false,
        'unknown',
        parseFloat(resource.amount.value),
        resource.amount.currency_code,
        ipAddress,
        userAgent,
      );

      this.logger.log(`PayPal payment denied: ${customId}`);
    } catch (error) {
      this.logger.error('Failed to handle PayPal payment denial:', error);
    }
  }

  /**
   * Handle refunded PayPal payment
   */
  private async handlePayPalPaymentRefunded(
    body: any,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const resource = body.resource;
    const customId = resource.custom_id;
    
    if (!customId) {
      this.logger.warn('PayPal payment refunded but no custom_id');
      return;
    }

    try {
      // Log the refund event
      await this.auditService.logPaymentEvent({
        type: 'payment_refunded',
        paymentId: customId,
        userId: 'unknown',
        amount: parseFloat(resource.amount.value),
        provider: 'paypal',
        providerTransactionId: resource.id,
        ipAddress,
        userAgent,
      });

      this.logger.log(`PayPal payment refunded: ${customId}`);
    } catch (error) {
      this.logger.error('Failed to handle PayPal payment refund:', error);
    }
  }

  /**
   * Verify PayPal webhook (simplified implementation)
   */
  private async verifyPayPalWebhook(body: any, headers: Record<string, string>): Promise<boolean> {
    // In a production environment, you should implement proper PayPal webhook verification
    // This involves verifying the webhook signature using PayPal's public key
    // For now, we'll do basic validation
    
    return !!(
      body &&
      body.event_type &&
      body.resource &&
      headers['paypal-transmission-id'] &&
      headers['paypal-cert-id'] &&
      headers['paypal-transmission-sig']
    );
  }
}