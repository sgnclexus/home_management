import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { AgreementStatus } from '@home-management/types';

export class UpdateAgreementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'expired', 'cancelled'])
  status?: AgreementStatus;

  @IsOptional()
  @IsDateString()
  effectiveDate?: Date;

  @IsOptional()
  @IsDateString()
  expirationDate?: Date;
}