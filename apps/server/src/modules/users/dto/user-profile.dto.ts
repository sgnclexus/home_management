import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Language } from '@home-management/types';

export class UserProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  apartmentNumber?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(['es', 'en'])
  preferredLanguage?: Language;
}