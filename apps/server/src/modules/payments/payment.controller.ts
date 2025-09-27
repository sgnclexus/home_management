import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { PaymentAuditService } from './payment-audit.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { 
  Payment, 
  PaymentResult, 
  PaymentStatus,
  PaymentAuditReport,
  AuditLogFilters,
  UserRole 
} from '@home-management/types';

interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
    role: string;
  };
}

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly auditService: PaymentAuditService,
  ) {}

  /**
   * Create a new payment (Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: any,
  ): Promise<Payment> {
    const paymentData = {
      ...createPaymentDto,
      dueDate: new Date(createPaymentDto.dueDate),
    };
    return this.paymentService.createPayment(paymentData);
  }

  /**
   * Process a payment
   */
  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  async processPayment(
    @Param('id') paymentId: string,
    @Body() processPaymentDto: ProcessPaymentDto,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: any,
  ): Promise<PaymentResult> {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    return this.paymentService.processPayment(
      paymentId,
      processPaymentDto.paymentMethod,
      processPaymentDto.paymentDetails,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get payment by ID
   */
  @Get(':id')
  async getPayment(
    @Param('id') paymentId: string,
    @CurrentUser() user: any,
  ): Promise<Payment> {
    const payment = await this.paymentService.getPaymentById(paymentId);
    
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // Users can only see their own payments unless they're admin
    if (user.role !== 'admin' && payment.userId !== user.uid) {
      throw new BadRequestException('Access denied');
    }

    return payment;
  }

  /**
   * Get payment history for current user
   */
  @Get('user/history')
  async getUserPaymentHistory(@CurrentUser() user: any): Promise<Payment[]> {
    return this.paymentService.getPaymentHistory(user.uid);
  }

  /**
   * Get payment history for specific user (Admin only)
   */
  @Get('user/:userId/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async getPaymentHistoryByUser(@Param('userId') userId: string): Promise<Payment[]> {
    return this.paymentService.getPaymentHistory(userId);
  }

  /**
   * Get all payments (Admin only)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async getAllPayments(): Promise<Payment[]> {
    return this.paymentService.getAllPayments();
  }

  /**
   * Get payments by status (Admin only)
   */
  @Get('status/:status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.VIGILANCE)
  async getPaymentsByStatus(@Param('status') status: PaymentStatus): Promise<Payment[]> {
    const validStatuses: PaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid payment status');
    }

    return this.paymentService.getPaymentsByStatus(status);
  }

  /**
   * Update payment status (Admin only)
   */
  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePaymentStatus(
    @Param('id') paymentId: string,
    @Body() updateStatusDto: UpdatePaymentStatusDto,
  ): Promise<Payment> {
    return this.paymentService.updatePaymentStatus(
      paymentId,
      updateStatusDto.status,
      updateStatusDto.transactionId,
    );
  }

  /**
   * Get payment audit report (Admin only)
   */
  @Get('audit/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPaymentAuditReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
  ): Promise<PaymentAuditReport> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate ? new Date(endDate) : new Date(); // Default: now

    return this.auditService.getPaymentAuditReport(start, end, userId);
  }

  /**
   * Get audit logs (Admin only)
   */
  @Get('audit/logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAuditLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('type') type?: string,
    @Query('action') action?: string,
    @Query('severity') severity?: string,
  ) {
    const filters: AuditLogFilters = {};

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (userId) filters.userId = userId;
    if (type) filters.type = type;
    if (action) filters.action = action;
    if (severity) filters.severity = severity;

    return this.auditService.getAuditLogs(filters);
  }
}