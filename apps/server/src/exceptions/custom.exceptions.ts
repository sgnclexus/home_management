import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentProcessingException extends HttpException {
  constructor(message: string, details?: any) {
    super(
      {
        message,
        code: 'PAYMENT_PROCESSING_ERROR',
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ReservationConflictException extends HttpException {
  constructor(message: string, conflictDetails?: any) {
    super(
      {
        message,
        code: 'RESERVATION_CONFLICT',
        details: conflictDetails,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class UnauthorizedAccessException extends HttpException {
  constructor(message: string = 'Access denied', requiredRole?: string) {
    super(
      {
        message,
        code: 'UNAUTHORIZED_ACCESS',
        details: requiredRole ? { requiredRole } : undefined,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(message: string, validationErrors?: Record<string, string[]>) {
    super(
      {
        message,
        code: 'VALIDATION_ERROR',
        details: validationErrors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    
    super(
      {
        message,
        code: 'RESOURCE_NOT_FOUND',
        details: { resource, identifier },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BusinessLogicException extends HttpException {
  constructor(message: string, code: string, details?: any) {
    super(
      {
        message,
        code,
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ExternalServiceException extends HttpException {
  constructor(service: string, message: string, originalError?: any) {
    super(
      {
        message: `External service error: ${message}`,
        code: 'EXTERNAL_SERVICE_ERROR',
        details: {
          service,
          originalError: originalError?.message || originalError,
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class RateLimitException extends HttpException {
  constructor(limit: number, windowMs: number, customMessage?: string) {
    const message = customMessage || `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms`;
    super(
      {
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        details: { limit, windowMs },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class SecurityException extends HttpException {
  constructor(message: string, securityType: string, riskScore?: number) {
    super(
      {
        message,
        code: 'SECURITY_VIOLATION',
        details: { securityType, riskScore },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class MaliciousRequestException extends HttpException {
  constructor(message: string, attackType: string, details?: any) {
    super(
      {
        message: `Malicious request detected: ${message}`,
        code: 'MALICIOUS_REQUEST',
        details: { attackType, ...details },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InputSanitizationException extends HttpException {
  constructor(fieldName: string, reason: string) {
    super(
      {
        message: `Invalid input in field '${fieldName}': ${reason}`,
        code: 'INPUT_SANITIZATION_ERROR',
        details: { fieldName, reason },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DataLeakageException extends HttpException {
  constructor(message: string, leakedFields: string[]) {
    super(
      {
        message: `Potential data leakage detected: ${message}`,
        code: 'DATA_LEAKAGE_DETECTED',
        details: { leakedFields },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class SuspiciousActivityException extends HttpException {
  constructor(message: string, activityType: string, riskScore: number) {
    super(
      {
        message: `Suspicious activity detected: ${message}`,
        code: 'SUSPICIOUS_ACTIVITY',
        details: { activityType, riskScore },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}