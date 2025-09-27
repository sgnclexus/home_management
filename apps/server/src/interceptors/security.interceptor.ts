import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import { SanitizationUtil } from '../utils/sanitization.util';

@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityInterceptor.name);

  constructor(private auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Extract request information
    const method = request.method;
    const url = request.url;
    const userAgent = SanitizationUtil.getUserAgent(request);
    const clientIP = SanitizationUtil.getClientIP(request);
    const userId = (request as any).user?.uid;

    // Generate correlation ID for request tracking
    const correlationId = this.generateCorrelationId();
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);

    // Log request start
    this.logger.debug(`Request started: ${method} ${url}`, {
      correlationId,
      clientIP,
      userId,
    });

    // Perform security checks
    this.performSecurityChecks(request, correlationId);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful request completion
        this.logRequestCompletion(
          request,
          response,
          duration,
          statusCode,
          correlationId,
          'success'
        );

        // Check for suspicious response patterns
        this.checkResponseSecurity(data, request, correlationId);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log error and security implications
        this.logRequestCompletion(
          request,
          response,
          duration,
          statusCode,
          correlationId,
          'error',
          error
        );

        // Analyze error for security implications
        this.analyzeErrorSecurity(error, request, correlationId);

        return throwError(error);
      })
    );
  }

  private performSecurityChecks(request: Request, correlationId: string): void {
    const clientIP = SanitizationUtil.getClientIP(request);
    const userAgent = SanitizationUtil.getUserAgent(request);
    const method = request.method;
    const url = request.url;

    // Check for suspicious patterns in URL
    if (this.containsSuspiciousPatterns(url)) {
      this.auditLogService.logSecurityEvent(
        'suspicious_activity',
        {
          type: 'suspicious_url',
          url,
          method,
          patterns: this.extractSuspiciousPatterns(url),
        },
        {
          ipAddress: clientIP,
          userAgent,
          correlationId,
          severity: 'warning',
          riskScore: 60,
        }
      );
    }

    // Check for suspicious headers
    const suspiciousHeaders = this.checkSuspiciousHeaders(request.headers);
    if (suspiciousHeaders.length > 0) {
      this.auditLogService.logSecurityEvent(
        'suspicious_activity',
        {
          type: 'suspicious_headers',
          headers: suspiciousHeaders,
        },
        {
          ipAddress: clientIP,
          userAgent,
          correlationId,
          severity: 'warning',
          riskScore: 40,
        }
      );
    }

    // Check request body for injection attempts
    if (request.body && typeof request.body === 'object') {
      const injectionAttempts = this.detectInjectionAttempts(request.body);
      if (injectionAttempts.length > 0) {
        this.auditLogService.logSecurityEvent(
          injectionAttempts.some(a => a.type === 'sql') ? 'sql_injection_attempt' : 'xss_attempt',
          {
            type: 'injection_attempt',
            attempts: injectionAttempts,
            endpoint: `${method} ${url}`,
          },
          {
            userId: (request as any).user?.uid,
            ipAddress: clientIP,
            userAgent,
            correlationId,
            severity: 'error',
            riskScore: 85,
          }
        );
      }
    }
  }

  private logRequestCompletion(
    request: Request,
    response: Response,
    duration: number,
    statusCode: number,
    correlationId: string,
    outcome: 'success' | 'error',
    error?: any
  ): void {
    const method = request.method;
    const url = request.url;
    const clientIP = SanitizationUtil.getClientIP(request);
    const userAgent = SanitizationUtil.getUserAgent(request);
    const userId = (request as any).user?.uid;

    // Log to audit service
    this.auditLogService.logUserAction(
      `${method.toLowerCase()}_request`,
      userId || 'anonymous',
      {
        endpoint: `${method} ${url}`,
        statusCode,
        duration,
        outcome,
        error: error ? {
          message: error.message,
          type: error.constructor.name,
        } : undefined,
      },
      {
        ipAddress: clientIP,
        userAgent,
        requestId: correlationId,
        severity: outcome === 'error' ? 'warning' : 'info',
      }
    );

    // Log performance issues
    if (duration > 5000) { // Requests taking more than 5 seconds
      this.auditLogService.logSystemEvent(
        'slow_request',
        {
          endpoint: `${method} ${url}`,
          duration,
          statusCode,
        },
        {
          severity: 'warning',
          requestId: correlationId,
        }
      );
    }
  }

  private checkResponseSecurity(data: any, request: Request, correlationId: string): void {
    if (!data || typeof data !== 'object') return;

    // Check for potential data leakage
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    const dataString = JSON.stringify(data).toLowerCase();
    
    const leakedFields = sensitiveFields.filter(field => 
      dataString.includes(`"${field}"`) || dataString.includes(`'${field}'`)
    );

    if (leakedFields.length > 0) {
      this.auditLogService.logSecurityEvent(
        'data_breach_attempt',
        {
          type: 'potential_data_leak',
          endpoint: `${request.method} ${request.url}`,
          leakedFields,
        },
        {
          userId: (request as any).user?.uid,
          ipAddress: SanitizationUtil.getClientIP(request),
          userAgent: SanitizationUtil.getUserAgent(request),
          correlationId,
          severity: 'critical',
          riskScore: 95,
        }
      );
    }
  }

  private analyzeErrorSecurity(error: any, request: Request, correlationId: string): void {
    const clientIP = SanitizationUtil.getClientIP(request);
    const userAgent = SanitizationUtil.getUserAgent(request);
    const userId = (request as any).user?.uid;

    // Check for authentication/authorization errors
    if (error.status === 401 || error.status === 403) {
      this.auditLogService.logSecurityEvent(
        'unauthorized_access',
        {
          endpoint: `${request.method} ${request.url}`,
          errorType: error.constructor.name,
          message: error.message,
        },
        {
          userId,
          ipAddress: clientIP,
          userAgent,
          correlationId,
          severity: 'warning',
          riskScore: 50,
        }
      );
    }

    // Check for validation errors that might indicate attacks
    if (error.status === 400 && error.message?.includes('validation')) {
      this.auditLogService.logSecurityEvent(
        'malicious_request',
        {
          endpoint: `${request.method} ${request.url}`,
          errorType: 'validation_failure',
          message: error.message,
        },
        {
          userId,
          ipAddress: clientIP,
          userAgent,
          correlationId,
          severity: 'warning',
          riskScore: 40,
        }
      );
    }
  }

  private containsSuspiciousPatterns(url: string): boolean {
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /\.\.\\/,  // Path traversal (Windows)
      /%2e%2e%2f/i,  // URL encoded path traversal
      /%2e%2e%5c/i,  // URL encoded path traversal (Windows)
      /\/etc\/passwd/,  // Unix password file
      /\/proc\/self\/environ/,  // Process environment
      /\/windows\/system32/i,  // Windows system directory
      /<script/i,  // Script injection
      /javascript:/i,  // JavaScript protocol
      /vbscript:/i,  // VBScript protocol
      /data:/i,  // Data protocol
      /union.*select/i,  // SQL injection
      /insert.*into/i,  // SQL injection
      /delete.*from/i,  // SQL injection
      /drop.*table/i,  // SQL injection
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  private extractSuspiciousPatterns(url: string): string[] {
    const patterns = [
      { name: 'path_traversal', regex: /\.\.\// },
      { name: 'script_injection', regex: /<script/i },
      { name: 'sql_injection', regex: /union.*select/i },
      { name: 'file_access', regex: /\/etc\/passwd/ },
    ];

    return patterns
      .filter(pattern => pattern.regex.test(url))
      .map(pattern => pattern.name);
  }

  private checkSuspiciousHeaders(headers: any): string[] {
    const suspicious: string[] = [];

    // Check for suspicious user agents
    const userAgent = headers['user-agent']?.toLowerCase() || '';
    const suspiciousUAPatterns = [
      'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
      'wget', 'curl', 'python-requests', 'go-http-client'
    ];

    if (suspiciousUAPatterns.some(pattern => userAgent.includes(pattern))) {
      suspicious.push('suspicious_user_agent');
    }

    // Check for missing common headers
    if (!headers['accept'] && !headers['user-agent']) {
      suspicious.push('missing_common_headers');
    }

    // Check for suspicious accept headers
    const accept = headers['accept']?.toLowerCase() || '';
    if (accept.includes('*/*') && !accept.includes('text/html')) {
      suspicious.push('suspicious_accept_header');
    }

    return suspicious;
  }

  private detectInjectionAttempts(body: any): Array<{ type: string; field: string; pattern: string }> {
    const attempts: Array<{ type: string; field: string; pattern: string }> = [];

    const checkValue = (value: any, fieldPath: string): void => {
      if (typeof value === 'string') {
        // SQL injection patterns
        const sqlPatterns = [
          { pattern: /union.*select/i, name: 'union_select' },
          { pattern: /insert.*into/i, name: 'insert_into' },
          { pattern: /delete.*from/i, name: 'delete_from' },
          { pattern: /drop.*table/i, name: 'drop_table' },
          { pattern: /exec.*xp_/i, name: 'exec_procedure' },
        ];

        sqlPatterns.forEach(({ pattern, name }) => {
          if (pattern.test(value)) {
            attempts.push({ type: 'sql', field: fieldPath, pattern: name });
          }
        });

        // XSS patterns
        const xssPatterns = [
          { pattern: /<script.*>/i, name: 'script_tag' },
          { pattern: /javascript:/i, name: 'javascript_protocol' },
          { pattern: /on\w+\s*=/i, name: 'event_handler' },
          { pattern: /<iframe.*>/i, name: 'iframe_tag' },
        ];

        xssPatterns.forEach(({ pattern, name }) => {
          if (pattern.test(value)) {
            attempts.push({ type: 'xss', field: fieldPath, pattern: name });
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => {
          checkValue(value[key], `${fieldPath}.${key}`);
        });
      }
    };

    Object.keys(body).forEach(key => {
      checkValue(body[key], key);
    });

    return attempts;
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}