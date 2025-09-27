import { IsString, IsArray, IsOptional, IsDateString, IsNumber, Min, IsEnum } from 'class-validator';
import { MeetingStatus } from '@home-management/types';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  agenda?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['scheduled', 'in_progress', 'completed', 'cancelled'])
  status?: MeetingStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;
}