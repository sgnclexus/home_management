import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { 
  Reservation, 
  CommonArea, 
  TimeSlot, 
  ReservationStatus,
  CreateReservationDto
} from '@home-management/types';
import { 
  FIRESTORE_COLLECTIONS,
  reservationToFirestoreDocument,
  firestoreDocumentToReservation,
  commonAreaToFirestoreDocument,
  firestoreDocumentToCommonArea,
  validateReservationDocument,
  validateCommonAreaDocument
} from '@home-management/utils';
import { FirebaseConfigService } from '../../config/firebase.config';
import { CreateCommonAreaDto } from './dto/create-common-area.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReservationService {
  constructor(private readonly firebaseService: FirebaseConfigService) {}

  /**
   * Create a new reservation
   */
  async createReservation(
    userId: string,
    createReservationDto: CreateReservationDto
  ): Promise<Reservation> {
    const { areaId, startTime, endTime, notes } = createReservationDto;
    
    // Validate dates - convert strings to Date objects if needed
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
    
    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }
    
    if (start < new Date()) {
      throw new BadRequestException('Cannot create reservations in the past');
    }

    // Get common area details
    const commonArea = await this.getCommonAreaById(areaId);
    if (!commonArea) {
      throw new NotFoundException(`Common area with ID ${areaId} not found`);
    }

    if (!commonArea.isActive) {
      throw new BadRequestException('Common area is not available for reservations');
    }

    // Check if the time slot is within available hours
    await this.validateTimeSlot(commonArea, start, end);

    // Check for conflicts
    const hasConflict = await this.checkReservationConflict(areaId, start, end);
    if (hasConflict) {
      throw new ConflictException('Time slot is already reserved');
    }

    // Create reservation
    const reservationId = uuidv4();
    const reservation: Reservation = {
      id: reservationId,
      userId,
      areaId,
      areaName: commonArea.name,
      startTime: start,
      endTime: end,
      status: 'confirmed',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const firestore = this.firebaseService.getFirestore();
    const docData = reservationToFirestoreDocument(reservation);
    
    await firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .doc(reservationId)
      .set({
        ...docData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return reservation;
  }

  /**
   * Get available time slots for a specific area and date
   */
  async getAvailableSlots(areaId: string, date: Date): Promise<TimeSlot[]> {
    const commonArea = await this.getCommonAreaById(areaId);
    if (!commonArea || !commonArea.isActive) {
      return [];
    }

    // Get start and end of the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get existing reservations for the day
    const existingReservations = await this.getReservationsByDateRange(areaId, startOfDay, endOfDay);

    // Generate time slots based on available hours
    const availableSlots = this.generateTimeSlots(commonArea, date, existingReservations);
    
    return availableSlots;
  }

  /**
   * Get reservations by user
   */
  async getReservationsByUser(userId: string): Promise<Reservation[]> {
    const firestore = this.firebaseService.getFirestore();
    
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .where('userId', '==', userId)
      .orderBy('startTime', 'desc')
      .get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (validateReservationDocument(data)) {
          return firestoreDocumentToReservation(data);
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Update reservation
   */
  async updateReservation(
    reservationId: string,
    userId: string,
    updateData: UpdateReservationDto
  ): Promise<Reservation> {
    const firestore = this.firebaseService.getFirestore();
    const docRef = firestore.collection(FIRESTORE_COLLECTIONS.RESERVATIONS).doc(reservationId);
    
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Reservation with ID ${reservationId} not found`);
    }

    const existingReservation = firestoreDocumentToReservation(doc.data() as any);
    
    // Check if user owns the reservation or is admin
    if (existingReservation.userId !== userId) {
      throw new BadRequestException('You can only update your own reservations');
    }

    // Validate time changes if provided
    if (updateData.startTime || updateData.endTime) {
      const newStartTime = updateData.startTime ? new Date(updateData.startTime) : existingReservation.startTime;
      const newEndTime = updateData.endTime ? new Date(updateData.endTime) : existingReservation.endTime;
      
      if (newStartTime >= newEndTime) {
        throw new BadRequestException('Start time must be before end time');
      }

      // Check for conflicts if time is being changed
      const hasConflict = await this.checkReservationConflict(
        existingReservation.areaId, 
        newStartTime, 
        newEndTime, 
        reservationId
      );
      
      if (hasConflict) {
        throw new ConflictException('New time slot conflicts with existing reservation');
      }
    }

    // Update the reservation
    const updateFields: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (updateData.startTime) {
      updateFields.startTime = Timestamp.fromDate(new Date(updateData.startTime));
    }
    if (updateData.endTime) {
      updateFields.endTime = Timestamp.fromDate(new Date(updateData.endTime));
    }
    if (updateData.status) {
      updateFields.status = updateData.status;
    }
    if (updateData.notes !== undefined) {
      updateFields.notes = updateData.notes;
    }

    await docRef.update(updateFields);

    // Return updated reservation
    const updatedDoc = await docRef.get();
    return firestoreDocumentToReservation(updatedDoc.data() as any);
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(reservationId: string, userId: string): Promise<void> {
    await this.updateReservation(reservationId, userId, { status: 'cancelled' });
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(reservationId: string): Promise<Reservation | null> {
    const firestore = this.firebaseService.getFirestore();
    
    const doc = await firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .doc(reservationId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (validateReservationDocument(data)) {
      return firestoreDocumentToReservation(data);
    }

    return null;
  }

  /**
   * Create a new common area
   */
  async createCommonArea(createAreaDto: CreateCommonAreaDto): Promise<CommonArea> {
    const areaId = uuidv4();
    const commonArea: CommonArea = {
      id: areaId,
      ...createAreaDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const firestore = this.firebaseService.getFirestore();
    const docData = commonAreaToFirestoreDocument(commonArea);
    
    await firestore
      .collection(FIRESTORE_COLLECTIONS.COMMON_AREAS)
      .doc(areaId)
      .set({
        ...docData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return commonArea;
  }

  /**
   * Get all common areas
   */
  async getCommonAreas(): Promise<CommonArea[]> {
    const firestore = this.firebaseService.getFirestore();
    
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.COMMON_AREAS)
      .where('isActive', '==', true)
      .orderBy('name')
      .get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (validateCommonAreaDocument(data)) {
          return firestoreDocumentToCommonArea(data);
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Get common area by ID
   */
  async getCommonAreaById(areaId: string): Promise<CommonArea | null> {
    const firestore = this.firebaseService.getFirestore();
    
    const doc = await firestore
      .collection(FIRESTORE_COLLECTIONS.COMMON_AREAS)
      .doc(areaId)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (validateCommonAreaDocument(data)) {
      return firestoreDocumentToCommonArea(data);
    }

    return null;
  }

  /**
   * Get all reservations (admin function)
   */
  async getAllReservations(): Promise<Reservation[]> {
    const firestore = this.firebaseService.getFirestore();
    
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .orderBy('startTime', 'desc')
      .get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (validateReservationDocument(data)) {
          return firestoreDocumentToReservation(data);
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Get reservations by date range (admin function)
   */
  async getReservationsByDateRangeAdmin(
    startDate: Date,
    endDate: Date,
    areaId?: string
  ): Promise<Reservation[]> {
    const firestore = this.firebaseService.getFirestore();
    
    let query = firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .where('startTime', '>=', Timestamp.fromDate(startDate))
      .where('startTime', '<=', Timestamp.fromDate(endDate));

    if (areaId) {
      query = query.where('areaId', '==', areaId);
    }

    const snapshot = await query.orderBy('startTime', 'asc').get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (validateReservationDocument(data)) {
          return firestoreDocumentToReservation(data);
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Private helper methods
   */

  private async checkReservationConflict(
    areaId: string,
    startTime: Date,
    endTime: Date,
    excludeReservationId?: string
  ): Promise<boolean> {
    const firestore = this.firebaseService.getFirestore();
    
    let query = firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .where('areaId', '==', areaId)
      .where('status', '==', 'confirmed');

    const snapshot = await query.get();
    
    for (const doc of snapshot.docs) {
      if (excludeReservationId && doc.id === excludeReservationId) {
        continue;
      }

      const reservation = firestoreDocumentToReservation(doc.data() as any);
      
      // Check for time overlap
      if (this.hasTimeOverlap(startTime, endTime, reservation.startTime, reservation.endTime)) {
        return true;
      }
    }

    return false;
  }

  private hasTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  private async validateTimeSlot(
    commonArea: CommonArea,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
    const [availableStartHour, availableStartMinute] = commonArea.availableHours.start.split(':').map(Number);
    const [availableEndHour, availableEndMinute] = commonArea.availableHours.end.split(':').map(Number);
    
    const availableStart = availableStartHour + availableStartMinute / 60;
    const availableEnd = availableEndHour + availableEndMinute / 60;

    if (startHour < availableStart || endHour > availableEnd) {
      throw new BadRequestException(
        `Reservation time must be between ${commonArea.availableHours.start} and ${commonArea.availableHours.end}`
      );
    }
  }

  private async getReservationsByDateRange(
    areaId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Reservation[]> {
    const firestore = this.firebaseService.getFirestore();
    
    const snapshot = await firestore
      .collection(FIRESTORE_COLLECTIONS.RESERVATIONS)
      .where('areaId', '==', areaId)
      .where('status', '==', 'confirmed')
      .where('startTime', '>=', Timestamp.fromDate(startDate))
      .where('startTime', '<=', Timestamp.fromDate(endDate))
      .get();

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (validateReservationDocument(data)) {
          return firestoreDocumentToReservation(data);
        }
        return null;
      })
      .filter(Boolean);
  }

  private generateTimeSlots(
    commonArea: CommonArea,
    date: Date,
    existingReservations: Reservation[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotDuration = 60; // 1 hour slots
    
    const [startHour, startMinute] = commonArea.availableHours.start.split(':').map(Number);
    const [endHour, endMinute] = commonArea.availableHours.end.split(':').map(Number);
    
    const startTime = new Date(date);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    let currentTime = new Date(startTime);
    
    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);
      
      if (slotEnd > endTime) {
        break;
      }
      
      // Check if this slot conflicts with existing reservations
      const isAvailable = !existingReservations.some(reservation =>
        this.hasTimeOverlap(currentTime, slotEnd, reservation.startTime, reservation.endTime)
      );
      
      slots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd),
        available: isAvailable,
      });
      
      currentTime = new Date(slotEnd);
    }
    
    return slots;
  }
}