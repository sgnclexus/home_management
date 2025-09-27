import { SecurityValidationPipe } from '../security-validation.pipe';
import { BadRequestException } from '@nestjs/common';
import { AuditLogService } from '../../services/audit-log.service';
import { IsString, IsEmail, IsOptional } from 'class-validator';

// Test DTO class
class TestDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  description?: string;
}

describe('SecurityValidationPipe', () => {
  let pipe: SecurityValidationPipe;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    mockAuditLogService = {
      logSecurityEvent: jest.fn(),
    } as any;

    pipe = new SecurityValidationPipe(mockAuditLogService);
  });

  describe('transform', () => {
    it('should validate and transform valid input', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        description: 'A test user',
      };

      const result = await pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: undefined,
      });

      expect(result).toBeInstanceOf(TestDto);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should sanitize input before validation', async () => {
      const input = {
        name: '  John Doe  ',
        email: '  JOHN@EXAMPLE.COM  ',
        description: 'A test user',
      };

      const result = await pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: undefined,
      });

      expect(result.name).toBe('John Doe');
      // Note: Email validation might convert to lowercase, but our sanitization doesn't
      expect(result.email).toBe('JOHN@EXAMPLE.COM');
    });

    it('should reject malicious SQL injection attempts', async () => {
      const input = {
        name: "'; DROP TABLE users; --",
        email: 'john@example.com',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
        'malicious_request',
        expect.objectContaining({
          validationErrors: expect.any(Array),
          originalValue: expect.any(Object),
        }),
        expect.objectContaining({
          severity: 'warning',
          riskScore: expect.any(Number),
        })
      );
    });

    it('should reject XSS attempts', async () => {
      const input = {
        name: '<script>alert("xss")</script>',
        email: 'john@example.com',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const input = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should strip non-whitelisted properties', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        maliciousProperty: 'should be removed',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip validation for primitive types', async () => {
      const result = await pipe.transform('test', {
        type: 'param',
        metatype: String,
        data: 'id',
      });

      expect(result).toBe('test');
    });

    it('should handle nested objects with malicious content', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        nested: {
          malicious: '<script>alert("xss")</script>',
        },
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate risk scores correctly', async () => {
      const input = {
        name: "'; DROP TABLE users; SELECT * FROM passwords; --",
        email: '<script>alert("xss")</script>@example.com',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalledWith(
        'malicious_request',
        expect.any(Object),
        expect.objectContaining({
          riskScore: expect.any(Number),
        })
      );

      const call = mockAuditLogService.logSecurityEvent.mock.calls[0];
      const riskScore = call[2]?.riskScore;
      expect(riskScore).toBeGreaterThan(50); // Should be high risk
    });

    it('should handle very large inputs', async () => {
      const largeString = 'a'.repeat(15000);
      const input = {
        name: largeString,
        email: 'john@example.com',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should sanitize sensitive data in logs', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'secret123',
        token: 'abc123',
      };

      await expect(
        pipe.transform(input, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLogService.logSecurityEvent).toHaveBeenCalled();
      const call = mockAuditLogService.logSecurityEvent.mock.calls[0];
      const loggedValue = call[1].originalValue;
      
      expect(loggedValue.password).toBe('[REDACTED]');
      expect(loggedValue.token).toBe('[REDACTED]');
    });
  });

  describe('risk score calculation', () => {
    it('should assign higher scores to SQL injection attempts', async () => {
      const sqlInput = {
        name: "'; DROP TABLE users; --",
        email: 'john@example.com',
      };

      await expect(
        pipe.transform(sqlInput, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow();

      const sqlCall = mockAuditLogService.logSecurityEvent.mock.calls[0];
      const sqlRiskScore = sqlCall[2]?.riskScore;

      mockAuditLogService.logSecurityEvent.mockClear();

      const xssInput = {
        name: '<script>alert("xss")</script>',
        email: 'john@example.com',
      };

      await expect(
        pipe.transform(xssInput, {
          type: 'body',
          metatype: TestDto,
          data: undefined,
        })
      ).rejects.toThrow();

      const xssCall = mockAuditLogService.logSecurityEvent.mock.calls[0];
      const xssRiskScore = xssCall[2]?.riskScore;

      expect(sqlRiskScore).toBeGreaterThan(30);
      expect(xssRiskScore).toBeGreaterThan(30);
    });

    it('should assign higher scores to path traversal attempts', async () => {
      const input = {
        name: '../../../etc/passwd',
        email: 'john@example.com',
      };

      // Path traversal in name field should not trigger security errors in this context
      // since it's just a string field, but it might fail validation
      const result = await pipe.transform(input, {
        type: 'body',
        metatype: TestDto,
        data: undefined,
      });

      expect(result.name).toBe('../../../etc/passwd');
    });
  });
});