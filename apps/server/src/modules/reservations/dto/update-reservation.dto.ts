import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { ReservationStatus } from '@home-management/types';

export class UpdateReservationDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(['confirmed', 'cancelled', 'completed'])
  status?: ReservationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}