import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any; // Assuming user is attached by auth guard
    const startTime = Date.now();

    const logData = {
      action: auditOptions.action,
      entityType: auditOptions.entityType,
      userId: user?.uid,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent'),
      requestId: request.headers['x-request-id'] as string,
      method: request.method,
      url: request.url,
      startTime,
    };

    return next.handle().pipe(
      tap((response) => {
        // Log successful operation
        this.logAuditEntry(
          logData,
          {
            success: true,
            duration: Date.now() - startTime,
            requestBody: auditOptions.includeRequestBody ? this.sanitizeData(request.body, auditOptions.sensitiveFields) : undefined,
            responseBody: auditOptions.includeResponseBody ? this.sanitizeData(response, auditOptions.sensitiveFields) : undefined,
          },
          auditOptions.severity || 'info',
        );
      }),
      catchError((error) => {
        // Log failed operation
        this.logAuditEntry(
          logData,
          {
            success: false,
            duration: Date.now() - startTime,
            error: error.message,
            errorStack: error.stack,
            requestBody: auditOptions.includeRequestBody ? this.sanitizeData(request.body, auditOptions.sensitiveFields) : undefined,
          },
          'error',
        );
        throw error;
      }),
    );
  }

  private async logAuditEntry(
    logData: any,
    additionalData: any,
    severity: 'info' | 'warning' | 'error' | 'critical',
  ) {
    try {
      await this.auditLogService.logUserAction(
        logData.action,
        logData.userId,
        {
          ...additionalData,
          method: logData.method,
          url: logData.url,
          entityType: logData.entityType,
        },
        {
          entityType: logData.entityType,
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
          requestId: logData.requestId,
          severity,
        },
      );
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  private sanitizeData(data: any, sensitiveFields: string[] = []): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const defaultSensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'credential',
      'authorization',
      'cookie',
    ];

    const allSensitiveFields = [...defaultSensitiveFields, ...sensitiveFields];

    const sanitize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        Object.keys(obj).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (allSensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitize(obj[key]);
          }
        });
        return result;
      }

      return obj;
    };

    return sanitize(data);
  }
}