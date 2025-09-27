import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { CreateCommonAreaDto } from './dto/create-common-area.dto';
import { Reservation, CommonArea, TimeSlot, CreateReservationDto } from '@home-management/types';

describe('ReservationService', () => {
  let service: ReservationService;
  let firebaseService: jest.Mocked<FirebaseConfigService>;

  const mockFirestore = {
    collection: jest.fn(),
    FieldValue: {
      serverTimestamp: jest.fn(() => ({ _methodName: 'FieldValue.serverTimestamp' })),
    },
    Timestamp: {
      fromDate: jest.fn((date: Date) => ({
        toDate: () => date,
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
      })),
    },
  };

  const mockCollection = {
    doc: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    get: jest.fn(),
  };

  const mockDoc = {
    set: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    exists: true,
    data: jest.fn(),
    id: 'test-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        {
          provide: FirebaseConfigService,
          useValue: {
            getFirestore: jest.fn(() => mockFirestore),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    firebaseService = module.get(FirebaseConfigService);

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock chain
    mockFirestore.collection.mockReturnValue(mockCollection);
    mockCollection.doc.mockReturnValue(mockDoc);
    mockCollection.where.mockReturnValue(mockCollection);
    mockCollection.orderBy.mockReturnValue(mockCollection);
    mockCollection.get.mockResolvedValue({ docs: [] });
    mockDoc.get.mockResolvedValue(mockDoc);
    mockDoc.set.mockResolvedValue(undefined);
    mockDoc.update.mockResolvedValue(undefined);
  });

  describe('createReservation', () => {
    const userId = 'user-123';
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    
    const createReservationDto: CreateReservationDto = {
      areaId: 'area-123',
      startTime: new Date(futureDate.getTime() + 2 * 60 * 60 * 1000), // +2 hours
      endTime: new Date(futureDate.getTime() + 4 * 60 * 60 * 1000), // +4 hours
      notes: 'Test reservation',
    };

    const mockCommonArea: CommonArea = {
      id: 'area-123',
      name: 'Swimming Pool',
      description: 'Olympic pool',
      capacity: 50,
      availableHours: { start: '06:00', end: '22:00' },
      isActive: true,
      rules: ['No diving'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Mock getCommonAreaById
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(mockCommonArea);
      
      // Mock checkReservationConflict
      jest.spyOn(service as any, 'checkReservationConflict').mockResolvedValue(false);
    });

    it('should create a reservation successfully', async () => {
      const result = await service.createReservation(userId, createReservationDto);

      expect(result).toMatchObject({
        userId,
        areaId: createReservationDto.areaId,
        areaName: mockCommonArea.name,
        status: 'confirmed',
        notes: createReservationDto.notes,
      });
      expect(mockDoc.set).toHaveBeenCalled();
    });

    it('should throw BadRequestException if start time is after end time', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const invalidDto = {
        ...createReservationDto,
        startTime: new Date(futureDate.getTime() + 4 * 60 * 60 * 1000), // +4 hours
        endTime: new Date(futureDate.getTime() + 2 * 60 * 60 * 1000), // +2 hours
      };

      await expect(service.createReservation(userId, invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException if reservation is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday
      
      const pastDto = {
        ...createReservationDto,
        startTime: new Date(pastDate.getTime() + 2 * 60 * 60 * 1000),
        endTime: new Date(pastDate.getTime() + 4 * 60 * 60 * 1000),
      };

      await expect(service.createReservation(userId, pastDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if common area does not exist', async () => {
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(null);

      await expect(service.createReservation(userId, createReservationDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if common area is not active', async () => {
      const inactiveArea = { ...mockCommonArea, isActive: false };
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(inactiveArea);

      await expect(service.createReservation(userId, createReservationDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ConflictException if time slot is already reserved', async () => {
      jest.spyOn(service as any, 'checkReservationConflict').mockResolvedValue(true);

      await expect(service.createReservation(userId, createReservationDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('getAvailableSlots', () => {
    const areaId = 'area-123';
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const date = futureDate;

    const mockCommonArea: CommonArea = {
      id: areaId,
      name: 'Swimming Pool',
      description: 'Olympic pool',
      capacity: 50,
      availableHours: { start: '09:00', end: '17:00' },
      isActive: true,
      rules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(mockCommonArea);
      jest.spyOn(service as any, 'getReservationsByDateRange').mockResolvedValue([]);
    });

    it('should return available time slots', async () => {
      const slots = await service.getAvailableSlots(areaId, date);

      expect(slots).toBeInstanceOf(Array);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('start');
      expect(slots[0]).toHaveProperty('end');
      expect(slots[0]).toHaveProperty('available');
    });

    it('should return empty array if common area does not exist', async () => {
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(null);

      const slots = await service.getAvailableSlots(areaId, date);

      expect(slots).toEqual([]);
    });

    it('should return empty array if common area is not active', async () => {
      const inactiveArea = { ...mockCommonArea, isActive: false };
      jest.spyOn(service, 'getCommonAreaById').mockResolvedValue(inactiveArea);

      const slots = await service.getAvailableSlots(areaId, date);

      expect(slots).toEqual([]);
    });

    it('should mark slots as unavailable when there are existing reservations', async () => {
      const reservationStart = new Date(date);
      reservationStart.setHours(10, 0, 0, 0);
      const reservationEnd = new Date(date);
      reservationEnd.setHours(11, 0, 0, 0);
      
      const existingReservation: Reservation = {
        id: 'res-123',
        userId: 'user-123',
        areaId,
        areaName: 'Swimming Pool',
        startTime: reservationStart,
        endTime: reservationEnd,
        status: 'confirmed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service as any, 'getReservationsByDateRange').mockResolvedValue([existingReservation]);

      const slots = await service.getAvailableSlots(areaId, date);

      // Find the slot that should be unavailable
      const unavailableSlot = slots.find(slot => 
        slot.start.getTime() === existingReservation.startTime.getTime()
      );

      expect(unavailableSlot?.available).toBe(false);
    });
  });

  describe('getReservationsByUser', () => {
    const userId = 'user-123';

    it('should return user reservations', async () => {
      const mockReservationData = {
        id: 'res-123',
        userId,
        areaId: 'area-123',
        areaName: 'Swimming Pool',
        startTime: mockFirestore.Timestamp.fromDate(new Date()),
        endTime: mockFirestore.Timestamp.fromDate(new Date()),
        status: 'confirmed',
        createdAt: mockFirestore.Timestamp.fromDate(new Date()),
        updatedAt: mockFirestore.Timestamp.fromDate(new Date()),
      };

      mockCollection.get.mockResolvedValue({
        docs: [{ data: () => mockReservationData }],
      });

      const reservations = await service.getReservationsByUser(userId);

      expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', userId);
      expect(mockCollection.orderBy).toHaveBeenCalledWith('startTime', 'desc');
      expect(reservations).toBeInstanceOf(Array);
    });
  });

  describe('createCommonArea', () => {
    const createAreaDto: CreateCommonAreaDto = {
      name: 'Swimming Pool',
      description: 'Olympic-size pool',
      capacity: 50,
      availableHours: { start: '06:00', end: '22:00' },
      isActive: true,
      rules: ['No diving', 'No glass containers'],
    };

    it('should create a common area successfully', async () => {
      const result = await service.createCommonArea(createAreaDto);

      expect(result).toMatchObject(createAreaDto);
      expect(result.id).toBeDefined();
      expect(mockDoc.set).toHaveBeenCalled();
    });
  });

  describe('getCommonAreas', () => {
    it('should return active common areas', async () => {
      const mockAreaData = {
        id: 'area-123',
        name: 'Swimming Pool',
        description: 'Olympic pool',
        capacity: 50,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: [],
        createdAt: mockFirestore.Timestamp.fromDate(new Date()),
        updatedAt: mockFirestore.Timestamp.fromDate(new Date()),
      };

      mockCollection.get.mockResolvedValue({
        docs: [{ data: () => mockAreaData }],
      });

      const areas = await service.getCommonAreas();

      expect(mockCollection.where).toHaveBeenCalledWith('isActive', '==', true);
      expect(mockCollection.orderBy).toHaveBeenCalledWith('name');
      expect(areas).toBeInstanceOf(Array);
    });
  });

  describe('updateReservation', () => {
    const reservationId = 'res-123';
    const userId = 'user-123';
    const updateData = { notes: 'Updated notes' };

    const mockReservationData = {
      id: reservationId,
      userId,
      areaId: 'area-123',
      areaName: 'Swimming Pool',
      startTime: mockFirestore.Timestamp.fromDate(new Date()),
      endTime: mockFirestore.Timestamp.fromDate(new Date()),
      status: 'confirmed',
      createdAt: mockFirestore.Timestamp.fromDate(new Date()),
      updatedAt: mockFirestore.Timestamp.fromDate(new Date()),
    };

    beforeEach(() => {
      mockDoc.data.mockReturnValue(mockReservationData);
      mockDoc.exists = true;
    });

    it('should update reservation successfully', async () => {
      const result = await service.updateReservation(reservationId, userId, updateData);

      expect(mockDoc.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if reservation does not exist', async () => {
      mockDoc.exists = false;

      await expect(service.updateReservation(reservationId, userId, updateData)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw BadRequestException if user does not own reservation', async () => {
      const differentUserData = { ...mockReservationData, userId: 'different-user' };
      mockDoc.data.mockReturnValueOnce(differentUserData);

      await expect(service.updateReservation(reservationId, userId, updateData)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('cancelReservation', () => {
    const reservationId = 'res-123';
    const userId = 'user-123';

    it('should cancel reservation by updating status', async () => {
      const updateSpy = jest.spyOn(service, 'updateReservation').mockResolvedValue({} as Reservation);

      await service.cancelReservation(reservationId, userId);

      expect(updateSpy).toHaveBeenCalledWith(reservationId, userId, { status: 'cancelled' });
    });
  });

  describe('private helper methods', () => {
    describe('hasTimeOverlap', () => {
      it('should detect time overlap correctly', () => {
        const start1 = new Date('2024-12-25T10:00:00Z');
        const end1 = new Date('2024-12-25T12:00:00Z');
        const start2 = new Date('2024-12-25T11:00:00Z');
        const end2 = new Date('2024-12-25T13:00:00Z');

        const hasOverlap = (service as any).hasTimeOverlap(start1, end1, start2, end2);

        expect(hasOverlap).toBe(true);
      });

      it('should not detect overlap for non-overlapping times', () => {
        const start1 = new Date('2024-12-25T10:00:00Z');
        const end1 = new Date('2024-12-25T12:00:00Z');
        const start2 = new Date('2024-12-25T13:00:00Z');
        const end2 = new Date('2024-12-25T15:00:00Z');

        const hasOverlap = (service as any).hasTimeOverlap(start1, end1, start2, end2);

        expect(hasOverlap).toBe(false);
      });
    });
  });
});