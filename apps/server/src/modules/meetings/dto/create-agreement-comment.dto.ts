import { IsString, IsOptional } from 'class-validator';

export class CreateAgreementCommentDto {
  @IsString()
  agreementId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}