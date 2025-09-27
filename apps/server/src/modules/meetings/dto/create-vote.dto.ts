import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateVoteDto {
  @IsString()
  meetingId: string;

  @IsString()
  question: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMultipleChoices?: boolean;
}