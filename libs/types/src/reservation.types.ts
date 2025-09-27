import { BaseEntity } from './common.types';

export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed';

export interface Reservation extends BaseEntity {
  userId: string;
  areaId: string;
  areaName: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  notes?: string;
}

export interface CommonArea extends BaseEntity {
  name: string;
  description: string;
  capacity: number;
  availableHours: {
    start: string;
    end: string;
  };
  isActive: boolean;
  rules: string[];
}

export interface CreateReservationDto {
  areaId: string;
  startTime: string | Date;
  endTime: string | Date;
  notes?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}