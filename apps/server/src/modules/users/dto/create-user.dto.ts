import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { UserRole, Language } from '@home-management/types';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  displayName: string;

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
  @IsString()
  uid?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}