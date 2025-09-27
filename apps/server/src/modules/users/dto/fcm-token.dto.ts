import { IsString } from 'class-validator';

export class FcmTokenDto {
  @IsString()
  fcmToken: string;
}