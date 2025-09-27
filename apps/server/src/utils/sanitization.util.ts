import { BadRequestException } from '@nestjs/common';

export class SanitizationUtil {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_FILENAME_LENGTH = 255;
  
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*[=<>]/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bINSERT\b.*\bINTO\b)/i,
    /(\bDROP\b.*\bTABLE\b)/i,
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
    /<meta\b[^<]*>/gi,
    /<link\b[^<]*>/gi,
  ];

  private static readonly DANGEROUS_FILE_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.ps1'
  ];

  /**
   * Sanitize string input to prevent injection attacks
   */
  static sanitizeString(input: string, fieldName?: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Check for SQL injection patterns
    if (this.detectSQLInjection(input)) {
      throw new BadRequestException(
        `Invalid input detected in ${fieldName || 'field'}: potential SQL injection`
      );
    }

    // Check for XSS patterns
    if (this.detectXSS(input)) {
      throw new BadRequestException(
        `Invalid input detected in ${fieldName || 'field'}: potential XSS attack`
      );
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length to prevent DoS
    if (sanitized.length > this.MAX_STRING_LENGTH) {
      throw new BadRequestException(
        `Input too long in ${fieldName || 'field'}: maximum ${this.MAX_STRING_LENGTH} characters allowed`
      );
    }

    return sanitized;
  }

  /**
   * Sanitize HTML content
   */
  static sanitizeHtml(input: string, fieldName?: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Check for XSS patterns first (before general string sanitization)
    if (this.detectXSS(input)) {
      throw new BadRequestException(
        `Invalid input detected in ${fieldName || 'field'}: potential XSS attack`
      );
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length to prevent DoS
    if (sanitized.length > this.MAX_STRING_LENGTH) {
      throw new BadRequestException(
        `Input too long in ${fieldName || 'field'}: maximum ${this.MAX_STRING_LENGTH} characters allowed`
      );
    }

    // Remove dangerous HTML tags and attributes
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/<meta\b[^<]*>/gi, '')
      .replace(/<link\b[^<]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '');

    return sanitized;
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return '';
    }

    // Check for dangerous file extensions
    const lowerFilename = filename.toLowerCase();
    const hasDangerousExtension = this.DANGEROUS_FILE_EXTENSIONS.some(ext => 
      lowerFilename.endsWith(ext)
    );

    if (hasDangerousExtension) {
      throw new BadRequestException('File type not allowed');
    }

    // Remove path traversal attempts and dangerous characters
    let sanitized = filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '');

    // Limit length
    if (sanitized.length > this.MAX_FILENAME_LENGTH) {
      const extension = sanitized.substring(sanitized.lastIndexOf('.'));
      const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
      sanitized = nameWithoutExt.substring(0, this.MAX_FILENAME_LENGTH - extension.length) + extension;
    }

    return sanitized;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input: any, min?: number, max?: number, fieldName?: string): number {
    // Check for null, undefined, or non-numeric types first
    if (input === null || input === undefined || typeof input === 'object' || Array.isArray(input)) {
      throw new BadRequestException(`Invalid number format in ${fieldName || 'field'}`);
    }
    
    const num = Number(input);
    
    if (isNaN(num) || !isFinite(num)) {
      throw new BadRequestException(`Invalid number format in ${fieldName || 'field'}`);
    }

    if (min !== undefined && num < min) {
      throw new BadRequestException(`Value too small in ${fieldName || 'field'}: minimum ${min}`);
    }

    if (max !== undefined && num > max) {
      throw new BadRequestException(`Value too large in ${fieldName || 'field'}: maximum ${max}`);
    }

    return num;
  }

  /**
   * Sanitize date input
   */
  static sanitizeDate(input: any, fieldName?: string): Date {
    if (!input) {
      throw new BadRequestException(`Date required in ${fieldName || 'field'}`);
    }

    const date = new Date(input);
    
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format in ${fieldName || 'field'}`);
    }

    return date;
  }

  /**
   * Sanitize UUID
   */
  static sanitizeUUID(input: string, fieldName?: string): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException(`UUID required in ${fieldName || 'field'}`);
    }

    const sanitized = this.sanitizeString(input, fieldName);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(sanitized)) {
      throw new BadRequestException(`Invalid UUID format in ${fieldName || 'field'}`);
    }

    return sanitized;
  }

  /**
   * Sanitize email
   */
  static sanitizeEmail(input: string, fieldName?: string): string {
    if (!input || typeof input !== 'string') {
      throw new BadRequestException(`Email required in ${fieldName || 'field'}`);
    }

    const sanitized = this.sanitizeString(input, fieldName).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(sanitized)) {
      throw new BadRequestException(`Invalid email format in ${fieldName || 'field'}`);
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any, depth = 0): any {
    if (depth > 10) {
      throw new BadRequestException('Object nesting too deep');
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number') {
      return this.sanitizeNumber(obj);
    }

    if (obj instanceof Date) {
      return obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        throw new BadRequestException('Array too large');
      }
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length > 100) {
        throw new BadRequestException('Object has too many properties');
      }

      const sanitized: any = {};
      for (const key of keys) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(obj[key], depth + 1);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Detect SQL injection patterns
   */
  private static detectSQLInjection(input: string): boolean {
    return this.SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS patterns
   */
  private static detectXSS(input: string): boolean {
    return this.XSS_PATTERNS.some(pattern => pattern.test(input));
  }

  /**
   * Validate IP address
   */
  static validateIPAddress(ip: string): boolean {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // More comprehensive IPv6 regex that handles compressed notation
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Get client IP from request
   */
  static getClientIP(request: any): string {
    if (!request || !request.headers) {
      return 'unknown';
    }

    const forwarded = request.headers['x-forwarded-for'];
    const realIP = request.headers['x-real-ip'];
    const remoteAddress = request.connection?.remoteAddress || request.socket?.remoteAddress;

    let ip = forwarded || realIP || remoteAddress || 'unknown';

    // Handle comma-separated IPs in x-forwarded-for
    if (typeof ip === 'string' && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    return this.validateIPAddress(ip) ? ip : 'unknown';
  }

  /**
   * Get user agent from request
   */
  static getUserAgent(request: any): string {
    if (!request || !request.headers) {
      return 'unknown';
    }

    const userAgent = request.headers['user-agent'] || 'unknown';
    if (userAgent === 'unknown') return userAgent;
    
    // For user agents, we only do basic sanitization without SQL/XSS checks
    // since legitimate user agents might contain patterns that look suspicious
    let sanitized = userAgent.replace(/[\x00-\x1F\x7F]/g, '').trim();
    return sanitized.substring(0, 500);
  }
}