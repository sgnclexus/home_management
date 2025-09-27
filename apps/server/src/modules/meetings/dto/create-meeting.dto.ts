import { IsString, IsArray, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMeetingDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsDateString()
  scheduledDate: Date;

  @IsArray()
  @IsString({ each: true })
  agenda: string[];

  @IsArray()
  @IsString({ each: true })
  attendees: string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;
}