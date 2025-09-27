import { IsString, IsArray } from 'class-validator';

export class CastVoteDto {
  @IsString()
  voteId: string;

  @IsArray()
  @IsString({ each: true })
  selectedOptions: string[];
}