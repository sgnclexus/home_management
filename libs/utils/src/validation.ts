import { UserRole, Language, CreateUserDto, UpdateUserDto, UserProfileDto, UserValidationResult } from '@home-management/types';

// Security constants
const MAX_STRING_LENGTH = 10000;
const MAX_FILENAME_LENGTH = 255;
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  /(--|\/\*|\*\/|;|'|"|`)/,
  /(\bOR\b|\bAND\b).*[=<>]/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
];

// Security utility functions
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > MAX_STRING_LENGTH) {
    sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
  }
  
  return sanitized;
};

export const sanitizeHtml = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Basic HTML sanitization - remove dangerous tags and attributes
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
  
  return sanitizeInput(sanitized);
};

export const sanitizeFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') return '';
  
  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/^\.+/, '')
    .substring(0, MAX_FILENAME_LENGTH);
};

export const validateIPAddress = (ip: string): boolean => {
  if (!ip || typeof ip !== 'string') return false;
  
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

export const detectSQLInjection = (input: string): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
};

export const detectXSS = (input: string): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  return XSS_PATTERNS.some(pattern => pattern.test(input));
};

export const isValidUUID = (uuid: string): boolean => {
  if (!uuid || typeof uuid !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const validateNumericInput = (value: any, min?: number, max?: number): boolean => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return false;
  
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  
  return true;
};

export const validateDateInput = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
};

// Enhanced security validation for all inputs
export const securityValidateInput = (input: any, fieldName: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (typeof input === 'string') {
    if (detectSQLInjection(input)) {
      errors.push(`${fieldName} contains potentially malicious SQL patterns`);
    }
    
    if (detectXSS(input)) {
      errors.push(`${fieldName} contains potentially malicious script content`);
    }
    
    if (input.length > MAX_STRING_LENGTH) {
      errors.push(`${fieldName} exceeds maximum length limit`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const isValidApartmentNumber = (apartmentNumber: string): boolean => {
  const apartmentRegex = /^[A-Za-z0-9\-]{1,10}$/;
  return apartmentRegex.test(apartmentNumber);
};

export const isValidUserRole = (role: string): role is UserRole => {
  return Object.values(UserRole).includes(role as UserRole);
};

export const isValidLanguage = (language: string): language is Language => {
  return ['es', 'en'].includes(language);
};

export const isValidDisplayName = (displayName: string): boolean => {
  return displayName.trim().length >= 2 && displayName.trim().length <= 50;
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateCreateUserDto = (userData: CreateUserDto): UserValidationResult => {
  const errors: Record<string, string[]> = {};

  // Security validation for all string fields
  Object.entries(userData).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const securityCheck = securityValidateInput(value, key);
      if (!securityCheck.isValid) {
        errors[key] = (errors[key] || []).concat(securityCheck.errors);
      }
    }
  });

  // Validate email
  if (!userData.email) {
    errors.email = (errors.email || []).concat(['Email is required']);
  } else {
    const sanitizedEmail = sanitizeInput(userData.email);
    if (!isValidEmail(sanitizedEmail)) {
      errors.email = (errors.email || []).concat(['Invalid email format']);
    }
  }

  // Validate display name
  if (!userData.displayName) {
    errors.displayName = (errors.displayName || []).concat(['Display name is required']);
  } else {
    const sanitizedName = sanitizeInput(userData.displayName);
    if (!isValidDisplayName(sanitizedName)) {
      errors.displayName = (errors.displayName || []).concat(['Display name must be between 2 and 50 characters']);
    }
  }

  // Validate role
  if (!userData.role) {
    errors.role = (errors.role || []).concat(['Role is required']);
  } else if (!isValidUserRole(userData.role)) {
    errors.role = (errors.role || []).concat(['Invalid user role']);
  }

  // Validate optional fields
  if (userData.phoneNumber) {
    const sanitizedPhone = sanitizeInput(userData.phoneNumber);
    if (!isValidPhoneNumber(sanitizedPhone)) {
      errors.phoneNumber = (errors.phoneNumber || []).concat(['Invalid phone number format']);
    }
  }

  if (userData.apartmentNumber) {
    const sanitizedApartment = sanitizeInput(userData.apartmentNumber);
    if (!isValidApartmentNumber(sanitizedApartment)) {
      errors.apartmentNumber = (errors.apartmentNumber || []).concat(['Invalid apartment number format']);
    }
  }

  if (userData.preferredLanguage && !isValidLanguage(userData.preferredLanguage)) {
    errors.preferredLanguage = (errors.preferredLanguage || []).concat(['Invalid language selection']);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateUpdateUserDto = (userData: UpdateUserDto): UserValidationResult => {
  const errors: Record<string, string[]> = {};

  // Validate display name if provided
  if (userData.displayName !== undefined) {
    if (!userData.displayName) {
      errors.displayName = ['Display name cannot be empty'];
    } else if (!isValidDisplayName(userData.displayName)) {
      errors.displayName = ['Display name must be between 2 and 50 characters'];
    }
  }

  // Validate role if provided
  if (userData.role !== undefined && !isValidUserRole(userData.role)) {
    errors.role = ['Invalid user role'];
  }

  // Validate optional fields if provided
  if (userData.phoneNumber !== undefined && userData.phoneNumber && !isValidPhoneNumber(userData.phoneNumber)) {
    errors.phoneNumber = ['Invalid phone number format'];
  }

  if (userData.apartmentNumber !== undefined && userData.apartmentNumber && !isValidApartmentNumber(userData.apartmentNumber)) {
    errors.apartmentNumber = ['Invalid apartment number format'];
  }

  if (userData.preferredLanguage !== undefined && !isValidLanguage(userData.preferredLanguage)) {
    errors.preferredLanguage = ['Invalid language selection'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateUserProfileDto = (profileData: UserProfileDto): UserValidationResult => {
  const errors: Record<string, string[]> = {};

  // Validate display name if provided
  if (profileData.displayName !== undefined) {
    if (!profileData.displayName) {
      errors.displayName = ['Display name cannot be empty'];
    } else if (!isValidDisplayName(profileData.displayName)) {
      errors.displayName = ['Display name must be between 2 and 50 characters'];
    }
  }

  // Validate optional fields if provided
  if (profileData.phoneNumber !== undefined && profileData.phoneNumber && !isValidPhoneNumber(profileData.phoneNumber)) {
    errors.phoneNumber = ['Invalid phone number format'];
  }

  if (profileData.apartmentNumber !== undefined && profileData.apartmentNumber && !isValidApartmentNumber(profileData.apartmentNumber)) {
    errors.apartmentNumber = ['Invalid apartment number format'];
  }

  if (profileData.preferredLanguage !== undefined && !isValidLanguage(profileData.preferredLanguage)) {
    errors.preferredLanguage = ['Invalid language selection'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};