import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { SanitizationUtil } from '../utils/sanitization.util';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class SecurityValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(SecurityValidationPipe.name);

  constructor(private auditLogService?: AuditLogService) {}

  async transform(value: any, { metatype, type, data }: ArgumentMetadata) {
    // Skip validation for primitive types and files
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    let sanitizedValue: any;
    
    try {
      // Sanitize the input object
      sanitizedValue = this.sanitizeInput(value, data);
    } catch (error) {
      // Log sanitization failure as security event
      if (this.auditLogService) {
        await this.auditLogService.logSecurityEvent(
          'malicious_request',
          {
            validationErrors: [error instanceof Error ? error.message : 'Sanitization failed'],
            originalValue: this.sanitizeForLogging(value),
            fieldName: data,
            type: type,
          },
          {
            severity: 'warning',
            riskScore: this.calculateValidationRiskScore([], value),
          }
        );
      }
      throw error;
    }

    // Transform to class instance
    const object = plainToClass(metatype, sanitizedValue);

    // Validate using class-validator
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform the object
      validateCustomDecorators: true,
    });

    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      
      // Log validation failure as security event
      if (this.auditLogService) {
        await this.auditLogService.logSecurityEvent(
          'malicious_request',
          {
            validationErrors: errorMessages,
            originalValue: this.sanitizeForLogging(value),
            fieldName: data,
            type: type,
          },
          {
            severity: 'warning',
            riskScore: this.calculateValidationRiskScore(errors, value),
          }
        );
      }

      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any, fieldName?: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      return SanitizationUtil.sanitizeObject(value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Sanitization failed for field ${fieldName}: ${errorMessage}`);
      throw new BadRequestException(`Invalid input format in ${fieldName || 'request'}`);
    }
  }

  private formatValidationErrors(errors: any[]): string[] {
    const messages: string[] = [];

    const extractMessages = (error: any, parentPath = ''): void => {
      const currentPath = parentPath ? `${parentPath}.${error.property}` : error.property;

      if (error.constraints) {
        Object.values(error.constraints).forEach((message: any) => {
          messages.push(`${currentPath}: ${message}`);
        });
      }

      if (error.children && error.children.length > 0) {
        error.children.forEach((child: any) => {
          extractMessages(child, currentPath);
        });
      }
    };

    errors.forEach(error => extractMessages(error));
    return messages;
  }

  private calculateValidationRiskScore(errors: any[], originalValue: any): number {
    let score = 0;

    // Base score for validation failures
    score += Math.min(errors.length * 10, 50);

    // Check for potential injection attempts
    const valueString = JSON.stringify(originalValue).toLowerCase();
    
    // SQL injection patterns
    const sqlPatterns = ['select', 'insert', 'update', 'delete', 'drop', 'union', 'script'];
    const sqlMatches = sqlPatterns.filter(pattern => valueString.includes(pattern)).length;
    score += sqlMatches * 15;

    // XSS patterns
    const xssPatterns = ['<script', 'javascript:', 'onerror', 'onload', '<iframe'];
    const xssMatches = xssPatterns.filter(pattern => valueString.includes(pattern)).length;
    score += xssMatches * 20;

    // Path traversal patterns
    if (valueString.includes('../') || valueString.includes('..\\')) {
      score += 25;
    }

    // Excessive length (potential DoS)
    if (valueString.length > 10000) {
      score += 30;
    }

    return Math.min(score, 100);
  }

  private sanitizeForLogging(value: any): any {
    if (!value || typeof value !== 'object') {
      return value;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    const sanitized = { ...value };

    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

// Decorator to apply security validation to specific endpoints
export function UseSecurityValidation() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    // This decorator can be used to mark endpoints that need extra security validation
    Reflect.defineMetadata('security-validation', true, target, propertyName);
  };
}