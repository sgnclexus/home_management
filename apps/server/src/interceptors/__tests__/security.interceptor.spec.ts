import { SecurityInterceptor } from '../security.interceptor';
import { AuditLogService } from '../../services/audit-log.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { HttpException } from '@nestjs/common';

describe('SecurityInterceptor', () => {
  let interceptor: SecurityInterceptor;
  let mockAuditLogService: jest.Mocked<AuditLogService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockAuditLogService = {
      logUserAction: jest.fn(),
      logSecurityEvent: jest.fn(),
      logSystemEvent: jest.fn(),
    } as any;

    mockRequest = {
      method: 'GET',
      url: '/api/users',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-forwarded-for': '192.168.1.1',
      },
      body: {},
      user: { uid: 'user123' },
    };

    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn(),
    } as any;

    interceptor = new SecurityInterceptor(mockAuditLogService);
  });

  describe('intercept', () => {
    it('should log successful requests', (done) => {
      const responseData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (data) => {
          expect(data).toBe(responseData);
          expect(mockAuditLogService.logUserAction).toHaveBeenCalledWith(
            'get_request',
            'user123',
            expect.objectContaining({
              endpoint: 'GET /api/users',
              statusCode: 200,
              outcome: 'success',
            }),
            expect.objectContaining({
              ipAddress: '192.168.1.1',
              severity: 'info',
            })
          );
          done();
        },
      });
    });

    it('should log failed requests', (done) => {
      const error = new HttpException('Not found', 404);
      mockCallHandler.handle.mockReturnValue(throwError(error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err).toBe(error);
          expect(mockAuditLogService.logUserAction).toHaveBeenCalledWith(
            'get_request',
            'user123',
            expect.objectContaining({
              endpoint: 'GET /api/users',
              statusCode: 404,
              outcome: 'error',
            }),
            expect.objectContaining({
              severity: 'warning',
            })
          );
          done();
        },
      });
    });

    it('should detect suspicious URL patterns', (done) => {
      mockRequest.url = '/api/users/../../../etc/passwd';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'suspicious_activity',
            expect.objectContaining({
              type: 'suspicious_url',
              url: '/api/users/../../../etc/passwd',
            }),
            expect.objectContaining({
              severity: 'warning',
              riskScore: 60,
            })
          );
          done();
        },
      });
    });

    it('should detect SQL injection in request body', (done) => {
      mockRequest.body = {
        name: "'; DROP TABLE users; --",
        email: 'test@example.com',
      };
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'sql_injection_attempt',
            expect.objectContaining({
              type: 'injection_attempt',
              attempts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'sql',
                  field: 'name',
                })
              ]),
            }),
            expect.objectContaining({
              severity: 'error',
              riskScore: 85,
            })
          );
          done();
        },
      });
    });

    it('should detect XSS attempts in request body', (done) => {
      mockRequest.body = {
        content: '<script>alert("xss")</script>',
      };
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'xss_attempt',
            expect.objectContaining({
              type: 'injection_attempt',
              attempts: expect.arrayContaining([
                expect.objectContaining({
                  type: 'xss',
                  field: 'content',
                })
              ]),
            }),
            expect.objectContaining({
              severity: 'error',
            })
          );
          done();
        },
      });
    });

    it('should detect suspicious user agents', (done) => {
      mockRequest.headers['user-agent'] = 'sqlmap/1.0';
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'suspicious_activity',
            expect.objectContaining({
              type: 'suspicious_headers',
              headers: expect.arrayContaining(['suspicious_user_agent']),
            }),
            expect.objectContaining({
              severity: 'warning',
            })
          );
          done();
        },
      });
    });

    it('should detect potential data leakage in responses', (done) => {
      const responseData = {
        user: {
          name: 'John Doe',
          password: 'secret123', // This should trigger data leakage detection
        },
      };
      mockCallHandler.handle.mockReturnValue(of(responseData));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'data_breach_attempt',
            expect.objectContaining({
              type: 'potential_data_leak',
              leakedFields: expect.arrayContaining(['password']),
            }),
            expect.objectContaining({
              severity: 'critical',
              riskScore: 95,
            })
          );
          done();
        },
      });
    });

    it('should log unauthorized access attempts', (done) => {
      const error = new HttpException('Unauthorized', 401);
      mockCallHandler.handle.mockReturnValue(throwError(error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'unauthorized_access',
            expect.objectContaining({
              endpoint: 'GET /api/users',
              errorType: 'HttpException',
            }),
            expect.objectContaining({
              severity: 'warning',
              riskScore: 50,
            })
          );
          done();
        },
      });
    });

    it('should log slow requests as system events', (done) => {
      mockCallHandler.handle.mockReturnValue(
        of({}).pipe(delay(6000))
      );

      // Mock Date.now to simulate slow request
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 7000; // 6 second difference
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSystemEvent).toHaveBeenCalledWith(
            'slow_request',
            expect.objectContaining({
              endpoint: 'GET /api/users',
              duration: 6000,
            }),
            expect.objectContaining({
              severity: 'warning',
            })
          );
          
          Date.now = originalDateNow;
          done();
        },
      });
    });

    it('should set correlation ID headers', (done) => {
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockRequest.headers['x-correlation-id']).toBeDefined();
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Correlation-ID',
            expect.any(String)
          );
          done();
        },
      });
    });

    it('should handle requests without user context', (done) => {
      mockRequest.user = undefined;
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logUserAction).toHaveBeenCalledWith(
            'get_request',
            'anonymous',
            expect.any(Object),
            expect.any(Object)
          );
          done();
        },
      });
    });

    it('should detect multiple injection patterns in nested objects', (done) => {
      mockRequest.body = {
        user: {
          name: "'; DROP TABLE users; --",
          bio: '<script>alert("xss")</script>',
        },
        settings: {
          theme: '<iframe src="javascript:alert(1)"></iframe>',
        },
      };
      mockCallHandler.handle.mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
            'sql_injection_attempt',
            expect.objectContaining({
              attempts: expect.arrayContaining([
                expect.objectContaining({ type: 'sql', field: 'user.name' }),
                expect.objectContaining({ type: 'xss', field: 'user.bio' }),
                expect.objectContaining({ type: 'xss', field: 'settings.theme' }),
              ]),
            }),
            expect.any(Object)
          );
          done();
        },
      });
    });
  });

  describe('security pattern detection', () => {
    it('should detect various SQL injection patterns', () => {
      const patterns = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM passwords",
        "INSERT INTO users VALUES",
        "DELETE FROM users WHERE",
        "EXEC xp_cmdshell",
      ];

      patterns.forEach(pattern => {
        mockRequest.body = { input: pattern };
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe();
        
        expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
          'sql_injection_attempt',
          expect.any(Object),
          expect.any(Object)
        );

        mockAuditLogService.logSecurityEvent.mockClear();
      });
    });

    it('should detect various XSS patterns', () => {
      const patterns = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img onerror="alert(1)" src="x">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<div onclick="alert(1)">Click</div>',
      ];

      patterns.forEach(pattern => {
        mockRequest.body = { input: pattern };
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe();
        
        expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
          'xss_attempt',
          expect.any(Object),
          expect.any(Object)
        );

        mockAuditLogService.logSecurityEvent.mockClear();
      });
    });

    it('should detect path traversal in URLs', () => {
      const suspiciousUrls = [
        '/api/files/../../../etc/passwd',
        '/api/files/..\\..\\windows\\system32\\config\\sam',
        '/api/files/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      suspiciousUrls.forEach(url => {
        mockRequest.url = url;
        mockCallHandler.handle.mockReturnValue(of({}));

        interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe();
        
        expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
          'suspicious_activity',
          expect.objectContaining({
            type: 'suspicious_url',
            url,
          }),
          expect.any(Object)
        );

        mockAuditLogService.logSecurityEvent.mockClear();
      });
    });
  });
});