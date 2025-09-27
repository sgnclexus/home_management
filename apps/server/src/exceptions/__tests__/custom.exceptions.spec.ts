import { HttpStatus } from '@nestjs/common';
import {
  PaymentProcessingException,
  ReservationConflictException,
  UnauthorizedAccessException,
  ValidationException,
  ResourceNotFoundException,
  BusinessLogicException,
  ExternalServiceException,
  RateLimitException,
} from '../custom.exceptions';

describe('Custom Exceptions', () => {
  describe('PaymentProcessingException', () => {
    it('should create exception with correct properties', () => {
      const details = { transactionId: '123', provider: 'stripe' };
      const exception = new PaymentProcessingException('Payment failed', details);

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.getResponse()).toEqual({
        message: 'Payment failed',
        code: 'PAYMENT_PROCESSING_ERROR',
        details,
      });
    });

    it('should create exception without details', () => {
      const exception = new PaymentProcessingException('Payment failed');

      expect(exception.getResponse()).toEqual({
        message: 'Payment failed',
        code: 'PAYMENT_PROCESSING_ERROR',
        details: undefined,
      });
    });
  });

  describe('ReservationConflictException', () => {
    it('should create exception with conflict details', () => {
      const conflictDetails = { 
        requestedSlot: '2024-01-15T10:00:00Z',
        conflictingReservation: 'res-123' 
      };
      const exception = new ReservationConflictException(
        'Time slot already booked',
        conflictDetails
      );

      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(exception.getResponse()).toEqual({
        message: 'Time slot already booked',
        code: 'RESERVATION_CONFLICT',
        details: conflictDetails,
      });
    });

    it('should create exception without conflict details', () => {
      const exception = new ReservationConflictException('Conflict occurred');

      expect(exception.getResponse()).toEqual({
        message: 'Conflict occurred',
        code: 'RESERVATION_CONFLICT',
        details: undefined,
      });
    });
  });

  describe('UnauthorizedAccessException', () => {
    it('should create exception with required role', () => {
      const exception = new UnauthorizedAccessException('Admin access required', 'admin');

      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(exception.getResponse()).toEqual({
        message: 'Admin access required',
        code: 'UNAUTHORIZED_ACCESS',
        details: { requiredRole: 'admin' },
      });
    });

    it('should create exception with default message', () => {
      const exception = new UnauthorizedAccessException();

      expect(exception.getResponse()).toEqual({
        message: 'Access denied',
        code: 'UNAUTHORIZED_ACCESS',
        details: undefined,
      });
    });

    it('should create exception without required role', () => {
      const exception = new UnauthorizedAccessException('Custom message');

      expect(exception.getResponse()).toEqual({
        message: 'Custom message',
        code: 'UNAUTHORIZED_ACCESS',
        details: undefined,
      });
    });
  });

  describe('ValidationException', () => {
    it('should create exception with validation errors', () => {
      const validationErrors = {
        email: ['Email is required', 'Email must be valid'],
        password: ['Password is too short'],
      };
      const exception = new ValidationException('Validation failed', validationErrors);

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getResponse()).toEqual({
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
      });
    });

    it('should create exception without validation errors', () => {
      const exception = new ValidationException('Invalid input');

      expect(exception.getResponse()).toEqual({
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: undefined,
      });
    });
  });

  describe('ResourceNotFoundException', () => {
    it('should create exception with identifier', () => {
      const exception = new ResourceNotFoundException('User', '123');

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.getResponse()).toEqual({
        message: "User with identifier '123' not found",
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'User', identifier: '123' },
      });
    });

    it('should create exception without identifier', () => {
      const exception = new ResourceNotFoundException('Payment');

      expect(exception.getResponse()).toEqual({
        message: 'Payment not found',
        code: 'RESOURCE_NOT_FOUND',
        details: { resource: 'Payment', identifier: undefined },
      });
    });
  });

  describe('BusinessLogicException', () => {
    it('should create exception with custom code and details', () => {
      const details = { currentBalance: 100, requiredAmount: 150 };
      const exception = new BusinessLogicException(
        'Insufficient balance',
        'INSUFFICIENT_BALANCE',
        details
      );

      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.getResponse()).toEqual({
        message: 'Insufficient balance',
        code: 'INSUFFICIENT_BALANCE',
        details,
      });
    });

    it('should create exception without details', () => {
      const exception = new BusinessLogicException(
        'Business rule violation',
        'BUSINESS_RULE_VIOLATION'
      );

      expect(exception.getResponse()).toEqual({
        message: 'Business rule violation',
        code: 'BUSINESS_RULE_VIOLATION',
        details: undefined,
      });
    });
  });

  describe('ExternalServiceException', () => {
    it('should create exception with original error object', () => {
      const originalError = { code: 'TIMEOUT', message: 'Request timeout' };
      const exception = new ExternalServiceException(
        'PaymentGateway',
        'Service unavailable',
        originalError
      );

      expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(exception.getResponse()).toEqual({
        message: 'External service error: Service unavailable',
        code: 'EXTERNAL_SERVICE_ERROR',
        details: {
          service: 'PaymentGateway',
          originalError: 'Request timeout',
        },
      });
    });

    it('should create exception with original error string', () => {
      const originalError = 'Connection refused';
      const exception = new ExternalServiceException(
        'EmailService',
        'Failed to send email',
        originalError
      );

      expect(exception.getResponse()).toEqual({
        message: 'External service error: Failed to send email',
        code: 'EXTERNAL_SERVICE_ERROR',
        details: {
          service: 'EmailService',
          originalError: 'Connection refused',
        },
      });
    });

    it('should create exception without original error', () => {
      const exception = new ExternalServiceException(
        'NotificationService',
        'Service error'
      );

      expect(exception.getResponse()).toEqual({
        message: 'External service error: Service error',
        code: 'EXTERNAL_SERVICE_ERROR',
        details: {
          service: 'NotificationService',
          originalError: undefined,
        },
      });
    });
  });

  describe('RateLimitException', () => {
    it('should create exception with rate limit details', () => {
      const exception = new RateLimitException(100, 60000);

      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toEqual({
        message: 'Rate limit exceeded. Maximum 100 requests per 60000ms',
        code: 'RATE_LIMIT_EXCEEDED',
        details: { limit: 100, windowMs: 60000 },
      });
    });

    it('should create exception with different limits', () => {
      const exception = new RateLimitException(10, 1000);

      expect(exception.getResponse()).toEqual({
        message: 'Rate limit exceeded. Maximum 10 requests per 1000ms',
        code: 'RATE_LIMIT_EXCEEDED',
        details: { limit: 10, windowMs: 1000 },
      });
    });
  });
});