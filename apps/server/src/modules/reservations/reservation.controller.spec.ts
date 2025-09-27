import { Test, TestingModule } from '@nestjs/testing';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { NotificationService } from '../notifications/notification.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Reservation, CommonArea, TimeSlot, CreateReservationDto } from '@home-management/types';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';

describe('ReservationController', () => {
  let controller: ReservationController;
  let reservationService: jest.Mocked<ReservationService>;
  let notificationService: jest.Mocked<NotificationService>;

  const mockReservation: Reservation = {
    id: 'reservation-123',
    userId: 'user-123',
    areaId: 'area-123',
    areaName: 'Swimming Pool',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T12:00:00Z'),
    status: 'confirmed',
    notes: 'Birthday party',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockCommonArea: CommonArea = {
    id: 'area-123',
    name: 'Swimming Pool',
    description: 'Olympic-size swimming pool',
    capacity: 50,
    availableHours: { start: '06:00', end: '22:00' },
    isActive: true,
    rules: ['No glass containers', 'Children must be supervised'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockTimeSlots: TimeSlot[] = [
    {
      start: new Date('2024-01-15T10:00:00Z'),
      end: new Date('2024-01-15T11:00:00Z'),
      available: true,
    },
    {
      start: new Date('2024-01-15T11:00:00Z'),
      end: new Date('2024-01-15T12:00:00Z'),
      available: false,
    },
  ];

  beforeEach(async () => {
    const mockReservationService = {
      createReservation: jest.fn(),
      getAvailableSlots: jest.fn(),
      getReservationsByUser: jest.fn(),
      getCommonAreas: jest.fn(),
      getCommonAreaById: jest.fn(),
      getReservationById: jest.fn(),
      updateReservation: jest.fn(),
      cancelReservation: jest.fn(),
      createCommonArea: jest.fn(),
      getAllReservations: jest.fn(),
    };

    const mockNotificationService = {
      sendReservationConfirmation: jest.fn(),
      scheduleReservationReminder: jest.fn(),
      sendReservationUpdate: jest.fn(),
      sendReservationCancellation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationController],
      providers: [
        {
          provide: ReservationService,
          useValue: mockReservationService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<ReservationController>(ReservationController);
    reservationService = module.get(ReservationService);
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReservation', () => {
    const createReservationDto: CreateReservationDto = {
      areaId: 'area-123',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T12:00:00Z',
      notes: 'Birthday party',
    };

    it('should create a reservation successfully', async () => {
      reservationService.createReservation.mockResolvedValue(mockReservation);
      notificationService.sendReservationConfirmation.mockResolvedValue();
      notificationService.scheduleReservationReminder.mockResolvedValue();

      const result = await controller.createReservation('user-123', createReservationDto);

      expect(result).toEqual(mockReservation);
      expect(reservationService.createReservation).toHaveBeenCalledWith('user-123', createReservationDto);
      expect(notificationService.sendReservationConfirmation).toHaveBeenCalledWith(mockReservation);
      expect(notificationService.scheduleReservationReminder).toHaveBeenCalledWith(mockReservation);
    });

    it('should handle conflict exception', async () => {
      reservationService.createReservation.mockRejectedValue(
        new ConflictException('Time slot is already reserved')
      );

      await expect(
        controller.createReservation('user-123', createReservationDto)
      ).rejects.toThrow(ConflictException);
    });

    it('should handle bad request exception', async () => {
      reservationService.createReservation.mockRejectedValue(
        new BadRequestException('Start time must be before end time')
      );

      await expect(
        controller.createReservation('user-123', createReservationDto)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available time slots', async () => {
      reservationService.getAvailableSlots.mockResolvedValue(mockTimeSlots);

      const result = await controller.getAvailableSlots({
        areaId: 'area-123',
        date: '2024-01-15',
      });

      expect(result).toEqual(mockTimeSlots);
      expect(reservationService.getAvailableSlots).toHaveBeenCalledWith(
        'area-123',
        new Date('2024-01-15')
      );
    });
  });

  describe('getMyReservations', () => {
    it('should return user reservations', async () => {
      const reservations = [mockReservation];
      reservationService.getReservationsByUser.mockResolvedValue(reservations);

      const result = await controller.getMyReservations('user-123');

      expect(result).toEqual(reservations);
      expect(reservationService.getReservationsByUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getCommonAreas', () => {
    it('should return all common areas', async () => {
      const areas = [mockCommonArea];
      reservationService.getCommonAreas.mockResolvedValue(areas);

      const result = await controller.getCommonAreas();

      expect(result).toEqual(areas);
      expect(reservationService.getCommonAreas).toHaveBeenCalled();
    });
  });

  describe('getCommonAreaById', () => {
    it('should return common area by ID', async () => {
      reservationService.getCommonAreaById.mockResolvedValue(mockCommonArea);

      const result = await controller.getCommonAreaById('area-123');

      expect(result).toEqual(mockCommonArea);
      expect(reservationService.getCommonAreaById).toHaveBeenCalledWith('area-123');
    });

    it('should throw error when area not found', async () => {
      reservationService.getCommonAreaById.mockResolvedValue(null);

      await expect(controller.getCommonAreaById('nonexistent')).rejects.toThrow('Common area not found');
    });
  });

  describe('getReservationById', () => {
    it('should return reservation by ID', async () => {
      reservationService.getReservationById.mockResolvedValue(mockReservation);

      const result = await controller.getReservationById('reservation-123');

      expect(result).toEqual(mockReservation);
      expect(reservationService.getReservationById).toHaveBeenCalledWith('reservation-123');
    });

    it('should throw error when reservation not found', async () => {
      reservationService.getReservationById.mockResolvedValue(null);

      await expect(controller.getReservationById('nonexistent')).rejects.toThrow('Reservation not found');
    });
  });

  describe('updateReservation', () => {
    const updateDto = {
      startTime: '2024-01-15T14:00:00Z',
      notes: 'Updated notes',
    };

    it('should update reservation successfully', async () => {
      const updatedReservation = { 
        ...mockReservation, 
        startTime: new Date(updateDto.startTime),
        notes: updateDto.notes 
      };
      reservationService.updateReservation.mockResolvedValue(updatedReservation);
      notificationService.sendReservationUpdate.mockResolvedValue();

      const result = await controller.updateReservation('reservation-123', 'user-123', updateDto);

      expect(result).toEqual(updatedReservation);
      expect(reservationService.updateReservation).toHaveBeenCalledWith(
        'reservation-123',
        'user-123',
        updateDto
      );
      expect(notificationService.sendReservationUpdate).toHaveBeenCalledWith(updatedReservation);
    });

    it('should not send notification if time not changed', async () => {
      const updateDtoNoTime = { notes: 'Updated notes' };
      const updatedReservation = { ...mockReservation, notes: 'Updated notes' };
      reservationService.updateReservation.mockResolvedValue(updatedReservation);

      await controller.updateReservation('reservation-123', 'user-123', updateDtoNoTime);

      expect(notificationService.sendReservationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('cancelReservation', () => {
    it('should cancel reservation successfully', async () => {
      reservationService.getReservationById.mockResolvedValue(mockReservation);
      reservationService.cancelReservation.mockResolvedValue();
      notificationService.sendReservationCancellation.mockResolvedValue();

      await controller.cancelReservation('reservation-123', 'user-123');

      expect(reservationService.cancelReservation).toHaveBeenCalledWith('reservation-123', 'user-123');
      expect(notificationService.sendReservationCancellation).toHaveBeenCalledWith(mockReservation);
    });

    it('should handle cancellation when reservation not found', async () => {
      reservationService.getReservationById.mockResolvedValue(null);
      reservationService.cancelReservation.mockResolvedValue();

      await controller.cancelReservation('reservation-123', 'user-123');

      expect(reservationService.cancelReservation).toHaveBeenCalledWith('reservation-123', 'user-123');
      expect(notificationService.sendReservationCancellation).not.toHaveBeenCalled();
    });
  });

  describe('createCommonArea', () => {
    const createAreaDto = {
      name: 'Gym',
      description: 'Fully equipped gym',
      capacity: 20,
      availableHours: { start: '05:00', end: '23:00' },
      isActive: true,
      rules: ['Clean equipment after use'],
    };

    it('should create common area successfully', async () => {
      const newArea = { ...mockCommonArea, ...createAreaDto };
      reservationService.createCommonArea.mockResolvedValue(newArea);

      const result = await controller.createCommonArea(createAreaDto);

      expect(result).toEqual(newArea);
      expect(reservationService.createCommonArea).toHaveBeenCalledWith(createAreaDto);
    });
  });

  describe('getAllReservations', () => {
    it('should return all reservations for admin', async () => {
      const reservations = [mockReservation];
      reservationService.getAllReservations.mockResolvedValue(reservations);

      const result = await controller.getAllReservations();

      expect(result).toEqual(reservations);
      expect(reservationService.getAllReservations).toHaveBeenCalled();
    });
  });

  describe('adminUpdateReservation', () => {
    const updateDto = {
      status: 'cancelled' as const,
    };

    it('should update reservation as admin', async () => {
      const updatedReservation = { ...mockReservation, status: 'cancelled' as const };
      reservationService.getReservationById.mockResolvedValue(mockReservation);
      reservationService.updateReservation.mockResolvedValue(updatedReservation);

      const result = await controller.adminUpdateReservation('reservation-123', updateDto);

      expect(result).toEqual(updatedReservation);
      expect(reservationService.updateReservation).toHaveBeenCalledWith(
        'reservation-123',
        'user-123', // Original user ID
        updateDto
      );
    });

    it('should throw error when reservation not found', async () => {
      reservationService.getReservationById.mockResolvedValue(null);

      await expect(
        controller.adminUpdateReservation('nonexistent', updateDto)
      ).rejects.toThrow('Reservation not found');
    });
  });
});