import { SanitizationUtil } from '../sanitization.util';
import { BadRequestException } from '@nestjs/common';

describe('SanitizationUtil', () => {
  describe('sanitizeString', () => {
    it('should sanitize normal strings', () => {
      const input = '  Hello World  ';
      const result = SanitizationUtil.sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00\x01World\x7F';
      const result = SanitizationUtil.sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should detect SQL injection attempts', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM passwords",
        "INSERT INTO users VALUES",
      ];

      maliciousInputs.forEach(input => {
        expect(() => SanitizationUtil.sanitizeString(input, 'test')).toThrow(BadRequestException);
      });
    });

    it('should detect XSS attempts', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img onerror="alert(1)" src="x">',
        '<iframe src="javascript:alert(1)"></iframe>',
      ];

      maliciousInputs.forEach(input => {
        expect(() => SanitizationUtil.sanitizeString(input, 'test')).toThrow(BadRequestException);
      });
    });

    it('should handle empty and null inputs', () => {
      expect(SanitizationUtil.sanitizeString('')).toBe('');
      expect(SanitizationUtil.sanitizeString(null as any)).toBe('');
      expect(SanitizationUtil.sanitizeString(undefined as any)).toBe('');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(20000);
      expect(() => SanitizationUtil.sanitizeString(longString, 'test')).toThrow(BadRequestException);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove dangerous HTML tags', () => {
      const input = '<p>Safe content</p><script>alert("xss")</script>';
      expect(() => SanitizationUtil.sanitizeHtml(input)).toThrow(BadRequestException);
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      expect(() => SanitizationUtil.sanitizeHtml(input)).toThrow(BadRequestException);
    });

    it('should remove dangerous protocols', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      expect(() => SanitizationUtil.sanitizeHtml(input)).toThrow(BadRequestException);
    });

    it('should allow safe HTML content', () => {
      const input = '<p>This is <strong>safe</strong> content</p>';
      const result = SanitizationUtil.sanitizeHtml(input);
      expect(result).toContain('safe');
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });
  });

  describe('sanitizeFilename', () => {
    it('should sanitize normal filenames', () => {
      const input = 'document.pdf';
      const result = SanitizationUtil.sanitizeFilename(input);
      expect(result).toBe('document.pdf');
    });

    it('should remove dangerous characters', () => {
      const input = 'doc<>ument|?.pdf';
      const result = SanitizationUtil.sanitizeFilename(input);
      expect(result).toBe('document.pdf');
    });

    it('should prevent path traversal', () => {
      const input = '../../../etc/passwd';
      const result = SanitizationUtil.sanitizeFilename(input);
      expect(result).not.toContain('../');
    });

    it('should reject dangerous file extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'virus.com',
        'trojan.scr',
        'backdoor.php',
      ];

      dangerousFiles.forEach(filename => {
        expect(() => SanitizationUtil.sanitizeFilename(filename)).toThrow(BadRequestException);
      });
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300) + '.txt';
      const result = SanitizationUtil.sanitizeFilename(longFilename);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('sanitizeNumber', () => {
    it('should validate and return valid numbers', () => {
      expect(SanitizationUtil.sanitizeNumber(42)).toBe(42);
      expect(SanitizationUtil.sanitizeNumber('42')).toBe(42);
      expect(SanitizationUtil.sanitizeNumber(3.14)).toBe(3.14);
    });

    it('should enforce minimum values', () => {
      expect(() => SanitizationUtil.sanitizeNumber(5, 10)).toThrow(BadRequestException);
    });

    it('should enforce maximum values', () => {
      expect(() => SanitizationUtil.sanitizeNumber(15, 0, 10)).toThrow(BadRequestException);
    });

    it('should reject invalid numbers', () => {
      const invalidInputs = ['not a number', null, undefined, {}, []];
      
      invalidInputs.forEach(input => {
        expect(() => SanitizationUtil.sanitizeNumber(input)).toThrow(BadRequestException);
      });
      
      // Test special number cases separately
      expect(() => SanitizationUtil.sanitizeNumber(NaN)).toThrow(BadRequestException);
      expect(() => SanitizationUtil.sanitizeNumber(Infinity)).toThrow(BadRequestException);
      expect(() => SanitizationUtil.sanitizeNumber(-Infinity)).toThrow(BadRequestException);
    });
  });

  describe('sanitizeUUID', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];

      validUUIDs.forEach(uuid => {
        expect(SanitizationUtil.sanitizeUUID(uuid)).toBe(uuid);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567-e89b-12d3-a456-426614174000-extra',
        '',
        null,
        undefined,
      ];

      invalidUUIDs.forEach(uuid => {
        expect(() => SanitizationUtil.sanitizeUUID(uuid as any)).toThrow(BadRequestException);
      });
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate and normalize correct emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
      ];

      validEmails.forEach(email => {
        const result = SanitizationUtil.sanitizeEmail(email);
        expect(result).toBe(email.toLowerCase());
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user@domain',
        '',
        null,
        undefined,
      ];

      invalidEmails.forEach(email => {
        expect(() => SanitizationUtil.sanitizeEmail(email as any)).toThrow(BadRequestException);
      });
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '  John Doe  ',
        email: 'JOHN@EXAMPLE.COM',
        nested: {
          value: '<script>alert("xss")</script>',
        },
      };

      expect(() => SanitizationUtil.sanitizeObject(input)).toThrow(BadRequestException);
    });

    it('should handle arrays', () => {
      const input = {
        tags: ['  tag1  ', '  tag2  ', '<script>alert("xss")</script>'],
      };

      expect(() => SanitizationUtil.sanitizeObject(input)).toThrow(BadRequestException);
    });

    it('should limit object complexity', () => {
      // Create deeply nested object
      let deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested;
      }

      expect(() => SanitizationUtil.sanitizeObject(deepObject)).toThrow(BadRequestException);
    });

    it('should limit array size', () => {
      const largeArray = new Array(2000).fill('item');
      const input = { items: largeArray };

      expect(() => SanitizationUtil.sanitizeObject(input)).toThrow(BadRequestException);
    });

    it('should limit object properties', () => {
      const manyProps: any = {};
      for (let i = 0; i < 150; i++) {
        manyProps[`prop${i}`] = `value${i}`;
      }

      expect(() => SanitizationUtil.sanitizeObject(manyProps)).toThrow(BadRequestException);
    });
  });

  describe('validateIPAddress', () => {
    it('should validate IPv4 addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '127.0.0.1',
        '255.255.255.255',
        '0.0.0.0',
      ];

      validIPs.forEach(ip => {
        expect(SanitizationUtil.validateIPAddress(ip)).toBe(true);
      });
    });

    it('should validate IPv6 addresses', () => {
      const validIPs = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        '::1',
        '::',
      ];

      validIPs.forEach(ip => {
        expect(SanitizationUtil.validateIPAddress(ip)).toBe(true);
      });
    });

    it('should reject invalid IP addresses', () => {
      const invalidIPs = [
        '256.256.256.256',
        '192.168.1',
        'not.an.ip.address',
        '',
        null,
        undefined,
      ];

      invalidIPs.forEach(ip => {
        expect(SanitizationUtil.validateIPAddress(ip as any)).toBe(false);
      });
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        connection: {},
        socket: {},
      };

      const result = SanitizationUtil.getClientIP(mockRequest);
      expect(result).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const mockRequest = {
        headers: {
          'x-real-ip': '192.168.1.1',
        },
        connection: {},
        socket: {},
      };

      const result = SanitizationUtil.getClientIP(mockRequest);
      expect(result).toBe('192.168.1.1');
    });

    it('should extract IP from connection', () => {
      const mockRequest = {
        headers: {},
        connection: {
          remoteAddress: '192.168.1.1',
        },
        socket: {},
      };

      const result = SanitizationUtil.getClientIP(mockRequest);
      expect(result).toBe('192.168.1.1');
    });

    it('should return unknown for invalid IPs', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': 'invalid-ip',
        },
        connection: {},
        socket: {},
      };

      const result = SanitizationUtil.getClientIP(mockRequest);
      expect(result).toBe('unknown');
    });
  });

  describe('getUserAgent', () => {
    it('should extract and sanitize user agent', () => {
      const mockRequest = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };

      const result = SanitizationUtil.getUserAgent(mockRequest);
      expect(result).toContain('Mozilla/5.0');
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('should return unknown for missing user agent', () => {
      const mockRequest = {
        headers: {},
      };

      const result = SanitizationUtil.getUserAgent(mockRequest);
      expect(result).toBe('unknown');
    });

    it('should truncate very long user agents', () => {
      const longUserAgent = 'a'.repeat(1000);
      const mockRequest = {
        headers: {
          'user-agent': longUserAgent,
        },
      };

      const result = SanitizationUtil.getUserAgent(mockRequest);
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });
});