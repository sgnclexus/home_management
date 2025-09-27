import {
  isValidEmail,
  isValidPhoneNumber,
  isValidApartmentNumber,
  isValidUserRole,
  isValidLanguage,
  isValidDisplayName,
  validatePassword,
  validateCreateUserDto,
  validateUpdateUserDto,
  validateUserProfileDto,
} from '../validation';
import { UserRole, CreateUserDto, UpdateUserDto, UserProfileDto } from '@home-management/types';

describe('User Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate correct phone number formats', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(true);
      expect(isValidPhoneNumber('123-456-7890')).toBe(true);
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true);
      expect(isValidPhoneNumber('123 456 7890')).toBe(true);
    });

    it('should reject invalid phone number formats', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('abc-def-ghij')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('isValidApartmentNumber', () => {
    it('should validate correct apartment number formats', () => {
      expect(isValidApartmentNumber('101')).toBe(true);
      expect(isValidApartmentNumber('A-101')).toBe(true);
      expect(isValidApartmentNumber('B2')).toBe(true);
      expect(isValidApartmentNumber('PH-1')).toBe(true);
    });

    it('should reject invalid apartment number formats', () => {
      expect(isValidApartmentNumber('')).toBe(false);
      expect(isValidApartmentNumber('A very long apartment number')).toBe(false);
      expect(isValidApartmentNumber('101@')).toBe(false);
    });
  });

  describe('isValidUserRole', () => {
    it('should validate correct user roles', () => {
      expect(isValidUserRole('admin')).toBe(true);
      expect(isValidUserRole('vigilance')).toBe(true);
      expect(isValidUserRole('resident')).toBe(true);
      expect(isValidUserRole('security')).toBe(true);
    });

    it('should reject invalid user roles', () => {
      expect(isValidUserRole('invalid')).toBe(false);
      expect(isValidUserRole('ADMIN')).toBe(false);
      expect(isValidUserRole('')).toBe(false);
    });
  });

  describe('isValidLanguage', () => {
    it('should validate correct languages', () => {
      expect(isValidLanguage('es')).toBe(true);
      expect(isValidLanguage('en')).toBe(true);
    });

    it('should reject invalid languages', () => {
      expect(isValidLanguage('fr')).toBe(false);
      expect(isValidLanguage('ES')).toBe(false);
      expect(isValidLanguage('')).toBe(false);
    });
  });

  describe('isValidDisplayName', () => {
    it('should validate correct display names', () => {
      expect(isValidDisplayName('John Doe')).toBe(true);
      expect(isValidDisplayName('María García')).toBe(true);
      expect(isValidDisplayName('A'.repeat(50))).toBe(true);
    });

    it('should reject invalid display names', () => {
      expect(isValidDisplayName('A')).toBe(false);
      expect(isValidDisplayName('')).toBe(false);
      expect(isValidDisplayName('   ')).toBe(false);
      expect(isValidDisplayName('A'.repeat(51))).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('validateCreateUserDto', () => {
    const validUserData: CreateUserDto = {
      email: 'user@example.com',
      displayName: 'John Doe',
      role: UserRole.RESIDENT,
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    it('should validate correct user data', () => {
      const result = validateCreateUserDto(validUserData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidData = { ...validUserData };
      delete (invalidData as any).email;
      delete (invalidData as any).displayName;
      delete (invalidData as any).role;

      const result = validateCreateUserDto(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Email is required');
      expect(result.errors.displayName).toContain('Display name is required');
      expect(result.errors.role).toContain('Role is required');
    });

    it('should reject invalid field formats', () => {
      const invalidData: CreateUserDto = {
        email: 'invalid-email',
        displayName: 'A',
        role: 'invalid' as UserRole,
        apartmentNumber: 'invalid@apartment',
        phoneNumber: '123',
        preferredLanguage: 'fr' as any,
      };

      const result = validateCreateUserDto(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toContain('Invalid email format');
      expect(result.errors.displayName).toContain('Display name must be between 2 and 50 characters');
      expect(result.errors.role).toContain('Invalid user role');
      expect(result.errors.apartmentNumber).toContain('Invalid apartment number format');
      expect(result.errors.phoneNumber).toContain('Invalid phone number format');
      expect(result.errors.preferredLanguage).toContain('Invalid language selection');
    });
  });

  describe('validateUpdateUserDto', () => {
    it('should validate correct update data', () => {
      const updateData: UpdateUserDto = {
        displayName: 'Updated Name',
        role: UserRole.ADMIN,
        phoneNumber: '+9876543210',
      };

      const result = validateUpdateUserDto(updateData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should reject invalid field formats', () => {
      const updateData: UpdateUserDto = {
        displayName: 'A',
        role: 'invalid' as UserRole,
        phoneNumber: '123',
        apartmentNumber: 'invalid@apartment',
        preferredLanguage: 'fr' as any,
      };

      const result = validateUpdateUserDto(updateData);
      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toContain('Display name must be between 2 and 50 characters');
      expect(result.errors.role).toContain('Invalid user role');
      expect(result.errors.phoneNumber).toContain('Invalid phone number format');
      expect(result.errors.apartmentNumber).toContain('Invalid apartment number format');
      expect(result.errors.preferredLanguage).toContain('Invalid language selection');
    });

    it('should allow empty optional fields', () => {
      const updateData: UpdateUserDto = {
        phoneNumber: '',
        apartmentNumber: '',
      };

      const result = validateUpdateUserDto(updateData);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateUserProfileDto', () => {
    it('should validate correct profile data', () => {
      const profileData: UserProfileDto = {
        displayName: 'Updated Profile',
        apartmentNumber: '202',
        phoneNumber: '+1234567890',
        preferredLanguage: 'es',
      };

      const result = validateUserProfileDto(profileData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should reject invalid profile data', () => {
      const profileData: UserProfileDto = {
        displayName: 'A',
        apartmentNumber: 'invalid@apartment',
        phoneNumber: '123',
        preferredLanguage: 'fr' as any,
      };

      const result = validateUserProfileDto(profileData);
      expect(result.isValid).toBe(false);
      expect(result.errors.displayName).toContain('Display name must be between 2 and 50 characters');
      expect(result.errors.apartmentNumber).toContain('Invalid apartment number format');
      expect(result.errors.phoneNumber).toContain('Invalid phone number format');
      expect(result.errors.preferredLanguage).toContain('Invalid language selection');
    });
  });
});