import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { CreateReservationDto, Reservation, CommonArea, TimeSlot, UserRole } from '@home-management/types';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { CreateCommonAreaDto } from './dto/create-common-area.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@Controller('reservations')
@UseGuards(FirebaseAuthGuard)
export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post()
  async createReservation(
    @CurrentUser('uid') userId: string,
    @Body() createReservationDto: CreateReservationDto,
  ): Promise<Reservation> {
    const reservation = await this.reservationService.createReservation(
      userId,
      createReservationDto,
    );

    // Send confirmation notification
    await this.notificationService.sendReservationConfirmation(reservation);

    // Schedule reminder notification
    await this.notificationService.scheduleReservationReminder(reservation);

    return reservation;
  }

  @Get('availability')
  async getAvailableSlots(
    @Query() query: AvailabilityQueryDto,
  ): Promise<TimeSlot[]> {
    const date = new Date(query.date);
    return this.reservationService.getAvailableSlots(query.areaId, date);
  }

  @Get('my-reservations')
  async getMyReservations(
    @CurrentUser('uid') userId: string,
  ): Promise<Reservation[]> {
    return this.reservationService.getReservationsByUser(userId);
  }

  @Get('areas')
  async getCommonAreas(): Promise<CommonArea[]> {
    return this.reservationService.getCommonAreas();
  }

  @Get('areas/:areaId')
  async getCommonAreaById(@Param('areaId') areaId: string): Promise<CommonArea> {
    const area = await this.reservationService.getCommonAreaById(areaId);
    if (!area) {
      throw new Error('Common area not found');
    }
    return area;
  }

  @Get(':reservationId')
  async getReservationById(
    @Param('reservationId') reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationService.getReservationById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    return reservation;
  }

  @Put(':reservationId')
  async updateReservation(
    @Param('reservationId') reservationId: string,
    @CurrentUser('uid') userId: string,
    @Body() updateReservationDto: UpdateReservationDto,
  ): Promise<Reservation> {
    const updatedReservation = await this.reservationService.updateReservation(
      reservationId,
      userId,
      updateReservationDto,
    );

    // Send update notification if time changed
    if (updateReservationDto.startTime || updateReservationDto.endTime) {
      await this.notificationService.sendReservationUpdate(updatedReservation);
    }

    return updatedReservation;
  }

  @Delete(':reservationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelReservation(
    @Param('reservationId') reservationId: string,
    @CurrentUser('uid') userId: string,
  ): Promise<void> {
    // Get reservation details before cancellation for notification
    const reservation = await this.reservationService.getReservationById(reservationId);
    
    await this.reservationService.cancelReservation(reservationId, userId);

    // Send cancellation notification
    if (reservation) {
      await this.notificationService.sendReservationCancellation(reservation);
    }
  }

  // Admin-only endpoints
  @Post('areas')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCommonArea(
    @Body() createAreaDto: CreateCommonAreaDto,
  ): Promise<CommonArea> {
    return this.reservationService.createCommonArea(createAreaDto);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async getAllReservations(): Promise<Reservation[]> {
    return this.reservationService.getAllReservations();
  }

  @Put('admin/:reservationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUpdateReservation(
    @Param('reservationId') reservationId: string,
    @Body() updateReservationDto: UpdateReservationDto,
  ): Promise<Reservation> {
    // This would need admin-specific update logic in the service
    // For now, use regular update but without user restriction
    const reservation = await this.reservationService.getReservationById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    return this.reservationService.updateReservation(
      reservationId,
      reservation.userId, // Use original user ID
      updateReservationDto,
    );
  }
}