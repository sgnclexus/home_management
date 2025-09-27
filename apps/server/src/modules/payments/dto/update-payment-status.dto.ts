import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { PaymentStatus } from '@home-management/types';

export class UpdatePaymentStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pending', 'paid', 'overdue', 'cancelled'])
  status: PaymentStatus;

  @IsString()
  @IsOptional()
  transactionId?: string;
}