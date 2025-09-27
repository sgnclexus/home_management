import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { UserRole, Language } from '@home-management/types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  apartmentNumber?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(['es', 'en'])
  preferredLanguage?: Language;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}