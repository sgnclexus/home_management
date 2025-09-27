import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';

export interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  code: string;
  details?: any;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);
    
    // Log error with appropriate level
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;
    const requestId = request.headers['x-request-id'] as string;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      return {
        statusCode: status,
        timestamp,
        path,
        method,
        message: typeof exceptionResponse === 'string' 
          ? exceptionResponse 
          : (exceptionResponse as any).message || exception.message,
        code: this.getErrorCode(status, exception),
        details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
        requestId,
      };
    }

    if (exception instanceof ValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp,
        path,
        method,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: this.formatValidationErrors([exception]),
        requestId,
      };
    }

    if (exception instanceof Error) {
      // Handle specific error types
      if (exception.name === 'UnauthorizedError' || exception.message.includes('unauthorized')) {
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          timestamp,
          path,
          method,
          message: 'Unauthorized access',
          code: 'UNAUTHORIZED',
          requestId,
        };
      }

      if (exception.name === 'ForbiddenError' || exception.message.includes('forbidden')) {
        return {
          statusCode: HttpStatus.FORBIDDEN,
          timestamp,
          path,
          method,
          message: 'Access forbidden',
          code: 'FORBIDDEN',
          requestId,
        };
      }

      if (exception.name === 'NotFoundError' || exception.message.includes('not found')) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          timestamp,
          path,
          method,
          message: 'Resource not found',
          code: 'NOT_FOUND',
          requestId,
        };
      }
    }

    // Default to internal server error
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp,
      path,
      method,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId,
    };
  }

  private getErrorCode(status: number, exception: HttpException): string {
    const exceptionResponse = exception.getResponse();
    
    if (typeof exceptionResponse === 'object' && (exceptionResponse as any).code) {
      return (exceptionResponse as any).code;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  private formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    errors.forEach(error => {
      if (error.constraints) {
        result[error.property] = Object.values(error.constraints);
      }
      
      if (error.children && error.children.length > 0) {
        const childErrors = this.formatValidationErrors(error.children);
        Object.keys(childErrors).forEach(key => {
          result[`${error.property}.${key}`] = childErrors[key];
        });
      }
    });
    
    return result;
  }

  private logError(exception: unknown, request: Request, errorResponse: ErrorResponse) {
    const { statusCode, message, code, requestId } = errorResponse;
    const { method, url, ip, headers } = request;
    
    const logContext = {
      statusCode,
      method,
      url,
      ip,
      userAgent: headers['user-agent'],
      requestId,
      code,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${method} ${url} - ${statusCode} - ${message}`,
        exception instanceof Error ? exception.stack : exception,
        logContext,
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `${method} ${url} - ${statusCode} - ${message}`,
        logContext,
      );
    } else {
      this.logger.log(
        `${method} ${url} - ${statusCode} - ${message}`,
        logContext,
      );
    }
  }
}