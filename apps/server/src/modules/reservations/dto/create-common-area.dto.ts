import { IsString, IsNumber, IsBoolean, IsArray, IsObject, IsNotEmpty, Min } from 'class-validator';

export class CreateCommonAreaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsObject()
  availableHours: {
    start: string;
    end: string;
  };

  @IsBoolean()
  isActive: boolean;

  @IsArray()
  @IsString({ each: true })
  rules: string[];
}