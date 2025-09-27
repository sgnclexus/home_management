import { IsString, IsNotEmpty, IsIn, IsObject } from 'class-validator';
import { PaymentMethod } from '@home-management/types';

export class ProcessPaymentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['stripe', 'paypal'])
  paymentMethod: PaymentMethod;

  @IsObject()
  paymentDetails: any; // This will vary based on payment method
}

export class StripePaymentDetailsDto {
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}

export class PayPalPaymentDetailsDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}