import { IsString, IsNumber, IsDateString, IsPositive, IsNotEmpty, IsISO8601 } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsISO8601()
  dueDate: string; // Will be converted to Date
}