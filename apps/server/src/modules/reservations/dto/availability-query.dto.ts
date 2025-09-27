import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  areaId: string;

  @IsDateString()
  date: string;
}