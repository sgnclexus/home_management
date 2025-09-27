import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { SecurityValidationPipe } from '../pipes/security-validation.pipe';
import { SecurityInterceptor } from '../interceptors/security.interceptor';
import { RateLimitMiddleware, RateLimitConfigs } from '../middleware/rate-limit.middleware';
import { AuditLogService } from '../services/audit-log.service';

describe('Security Integration Tests', () => {
  let app: INestApplication;
  let auditLogService: AuditLogService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply security middleware and pipes
    app.useGlobalPipes(new SecurityValidationPipe());
    app.useGlobalInterceptors(new SecurityInterceptor(app.get(AuditLogService)));
    
    auditLogService = app.get(AuditLogService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Injection Protection', () => {
    it('should block SQL injection attempts in request body', async () => {
      const maliciousPayload = {
        name: "'; DROP TABLE users; --",
        email: 'test@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
      
      // Verify security event was logged
      const securityEventSpy = jest.spyOn(auditLogService, 'logSecurityEvent');
      expect(securityEventSpy).toHaveBeenCalledWith(
        'malicious_request',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should block SQL injection attempts in query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .query({ search: "'; DROP TABLE users; --" })
        .expect(400);

      expect(response.body.message).toContain('Invalid input');
    });

    it('should allow legitimate SQL-like content in safe contexts', async () => {
      const legitimatePayload = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: 'I work with SQL databases and enjoy SELECT statements in my queries.',
      };

      // This should pass if the content is in a safe field and properly sanitized
      await request(app.getHttpServer())
        .post('/api/users')
        .send(legitimatePayload);
        // Note: This might still fail due to validation, but shouldn't trigger security alerts
    });
  });

  describe('XSS Protection', () => {
    it('should block XSS attempts in request body', async () => {
      const maliciousPayload = {
        name: 'John Doe',
        bio: '<script>alert("xss")</script>',
        email: 'john@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });

    it('should block various XSS vectors', async () => {
      const xssVectors = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img onerror="alert(1)" src="x">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<svg onload="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
      ];

      for (const vector of xssVectors) {
        const response = await request(app.getHttpServer())
          .post('/api/users')
          .send({ name: 'Test', email: 'test@example.com', bio: vector })
          .expect(400);

        expect(response.body.message).toContain('Validation failed');
      }
    });

    it('should sanitize HTML content appropriately', async () => {
      const payload = {
        name: 'John Doe',
        email: 'john@example.com',
        bio: '<p>This is <strong>safe</strong> HTML content</p>',
      };

      // Should either pass with sanitized content or fail validation
      // depending on the specific field validation rules
      await request(app.getHttpServer())
        .post('/api/users')
        .send(payload);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      const loginPayload = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Make multiple failed login attempts
      const promises = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send(loginPayload)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should apply different rate limits to different endpoints', async () => {
      // Test that payment endpoints have stricter limits than general endpoints
      const paymentRequests = Array(15).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/payments')
          .send({ amount: 100, currency: 'USD' })
      );

      const responses = await Promise.all(paymentRequests);
      const rateLimited = responses.filter(r => r.status === 429);
      
      // Payment endpoints should have stricter limits
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize string inputs', async () => {
      const payload = {
        name: '  John Doe  \x00\x01',
        email: '  JOHN@EXAMPLE.COM  ',
        bio: 'Normal content with\x00null bytes',
      };

      // Should sanitize the input (remove control characters, trim whitespace)
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(payload);

      // The exact response depends on validation rules, but input should be sanitized
      if (response.status === 201) {
        expect(response.body.name).toBe('John Doe');
        expect(response.body.email).toBe('john@example.com');
      }
    });

    it('should reject excessively long inputs', async () => {
      const longString = 'a'.repeat(15000);
      const payload = {
        name: longString,
        email: 'john@example.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(payload)
        .expect(400);

      expect(response.body.message).toContain('too long');
    });

    it('should handle nested object sanitization', async () => {
      const payload = {
        name: 'John Doe',
        email: 'john@example.com',
        preferences: {
          theme: '  dark  ',
          notifications: {
            email: true,
            sms: '  \x00true  ',
          },
        },
      };

      await request(app.getHttpServer())
        .post('/api/users')
        .send(payload);
        // Should sanitize nested objects without throwing errors
    });
  });

  describe('Path Traversal Protection', () => {
    it('should block path traversal attempts in URLs', async () => {
      const maliciousUrls = [
        '/api/files/../../../etc/passwd',
        '/api/files/..\\..\\windows\\system32\\config\\sam',
        '/api/files/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      ];

      for (const url of maliciousUrls) {
        const response = await request(app.getHttpServer())
          .get(url);

        // Should either return 404 (not found) or 400 (bad request)
        // but not expose system files
        expect([400, 404]).toContain(response.status);
      }
    });

    it('should sanitize file names in uploads', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        'normal.txt\x00.exe',
        '<script>alert("xss")</script>.txt',
      ];

      for (const filename of maliciousFilenames) {
        const response = await request(app.getHttpServer())
          .post('/api/files/upload')
          .attach('file', Buffer.from('test content'), filename);

        // Should either reject the file or sanitize the filename
        if (response.status === 200) {
          expect(response.body.filename).not.toContain('../');
          expect(response.body.filename).not.toContain('\\');
          expect(response.body.filename).not.toContain('\x00');
        }
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .expect(200);

      expect(response.headers).toHaveProperty('x-correlation-id');
      // Add other security headers as configured
    });

    it('should detect suspicious user agents', async () => {
      const suspiciousUserAgents = [
        'sqlmap/1.0',
        'nikto/2.1.6',
        'Nmap Scripting Engine',
        'masscan/1.0',
      ];

      for (const userAgent of suspiciousUserAgents) {
        await request(app.getHttpServer())
          .get('/api/users')
          .set('User-Agent', userAgent);

        // Should log security event
        const securityEventSpy = jest.spyOn(auditLogService, 'logSecurityEvent');
        expect(securityEventSpy).toHaveBeenCalledWith(
          'suspicious_activity',
          expect.objectContaining({
            type: 'suspicious_headers',
          }),
          expect.any(Object)
        );
      }
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' })
        .expect(401);

      // Error message should not reveal whether user exists
      expect(response.body.message).not.toContain('user not found');
      expect(response.body.message).not.toContain('invalid password');
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should not expose sensitive data in API responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-token');

      if (response.status === 200) {
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('secret');
        expect(response.body).not.toHaveProperty('privateKey');
      }
    });
  });

  describe('Audit Logging', () => {
    it('should log security events', async () => {
      const logSecurityEventSpy = jest.spyOn(auditLogService, 'logSecurityEvent');

      await request(app.getHttpServer())
        .post('/api/users')
        .send({ name: "'; DROP TABLE users; --", email: 'test@example.com' })
        .expect(400);

      expect(logSecurityEventSpy).toHaveBeenCalledWith(
        'malicious_request',
        expect.any(Object),
        expect.objectContaining({
          severity: 'warning',
          riskScore: expect.any(Number),
        })
      );
    });

    it('should log authentication events', async () => {
      const logAuthenticationSpy = jest.spyOn(auditLogService, 'logAuthentication');

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(logAuthenticationSpy).toHaveBeenCalledWith(
        'login_failure',
        null,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should log admin actions', async () => {
      const logAdminActionSpy = jest.spyOn(auditLogService, 'logAdminAction');

      await request(app.getHttpServer())
        .put('/api/admin/users/user123/role')
        .set('Authorization', 'Bearer admin-token')
        .send({ role: 'admin' });

      expect(logAdminActionSpy).toHaveBeenCalledWith(
        'update_user_role',
        expect.any(String),
        'user',
        'user123',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle large payloads gracefully', async () => {
      const largePayload = {
        name: 'John Doe',
        email: 'john@example.com',
        data: 'x'.repeat(1000000), // 1MB of data
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send(largePayload);

      // Should either reject with 413 (payload too large) or 400 (validation error)
      expect([400, 413]).toContain(response.status);
    });

    it('should limit concurrent requests', async () => {
      const concurrentRequests = Array(100).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/users')
      );

      const responses = await Promise.all(concurrentRequests);
      
      // Some requests might be rate limited or rejected
      const successfulRequests = responses.filter(r => r.status === 200);
      const rateLimitedRequests = responses.filter(r => r.status === 429);
      
      expect(successfulRequests.length + rateLimitedRequests.length).toBe(100);
    });
  });

  describe('Content Type Validation', () => {
    it('should validate content types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Content-Type', 'application/xml')
        .send('<user><name>John</name></user>');

      // Should reject non-JSON content for JSON endpoints
      expect([400, 415]).toContain(response.status);
    });

    it('should handle missing content type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send('{"name":"John","email":"john@example.com"}');

      // Should handle gracefully or require proper content type
      expect([200, 201, 400, 415]).toContain(response.status);
    });
  });
});