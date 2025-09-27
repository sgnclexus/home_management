import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { UserRole, User, CreateUserDto, UpdateUserDto, UserProfileDto } from '@home-management/types';

// Mock Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

const mockFirebaseConfigService = {
  getFirestore: jest.fn(() => mockFirestore),
};

describe('UsersService', () => {
  let service: UsersService;
  let firebaseConfigService: FirebaseConfigService;

  const mockUser: User = {
    id: 'test-uid',
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.RESIDENT,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockUserDocument = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.RESIDENT,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: { toDate: () => new Date('2023-01-01') },
    updatedAt: { toDate: () => new Date('2023-01-01') },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseConfigService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    firebaseConfigService = module.get<FirebaseConfigService>(FirebaseConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      displayName: 'Test User',
      role: UserRole.RESIDENT,
      apartmentNumber: '101',
      phoneNumber: '+1234567890',
      preferredLanguage: 'en',
    };

    it('should create a user successfully', async () => {
      // Mock findByEmail to return null (user doesn't exist)
      mockFirestore.where.mockReturnValueOnce({
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      });

      // Mock document creation
      mockFirestore.doc.mockReturnValueOnce({
        id: 'generated-uid',
      });

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.get.mockResolvedValue({
        data: () => mockUserDocument,
      });

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(result.displayName).toBe(createUserDto.displayName);
      expect(mockFirestore.set).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      // Mock findByEmail to return existing user
      mockFirestore.where.mockReturnValueOnce({
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ data: () => mockUserDocument }],
        }),
      });

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const invalidDto = { ...createUserDto, email: 'invalid-email' };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByUid', () => {
    it('should return user if found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
        data: () => mockUserDocument,
      });

      const result = await service.findByUid('test-uid');

      expect(result).toBeDefined();
      expect(result?.uid).toBe('test-uid');
    });

    it('should return null if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      const result = await service.findByUid('non-existent-uid');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      mockFirestore.where.mockReturnValueOnce({
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ data: () => mockUserDocument }],
        }),
      });

      const result = await service.findByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null if user not found', async () => {
      mockFirestore.where.mockReturnValueOnce({
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true }),
      });

      const result = await service.findByEmail('non-existent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      displayName: 'Updated Name',
      phoneNumber: '+9876543210',
    };

    it('should update user successfully', async () => {
      // Mock the first get call (check if user exists)
      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => mockUserDocument,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      // Mock updated document for the second get call
      const updatedDocument = {
        ...mockUserDocument,
        displayName: 'Updated Name',
        phoneNumber: '+9876543210',
      };

      mockFirestore.get.mockResolvedValueOnce({
        data: () => updatedDocument,
      });

      const result = await service.update('test-uid', updateUserDto);

      expect(result.displayName).toBe('Updated Name');
      expect(result.phoneNumber).toBe('+9876543210');
      expect(mockFirestore.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.update('non-existent-uid', updateUserDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const invalidDto = { displayName: 'A' }; // Too short

      await expect(service.update('test-uid', invalidDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRole', () => {
    it('should update user role successfully', async () => {
      // Mock the first get call (check if user exists)
      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => mockUserDocument,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      const updatedDocument = {
        ...mockUserDocument,
        role: UserRole.ADMIN,
      };

      // Mock the second get call (return updated document)
      mockFirestore.get.mockResolvedValueOnce({
        data: () => updatedDocument,
      });

      const result = await service.updateRole(
        'test-uid',
        { role: UserRole.ADMIN },
        UserRole.ADMIN
      );

      expect(result.role).toBe(UserRole.ADMIN);
      expect(mockFirestore.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException for insufficient permissions', async () => {
      await expect(
        service.updateRole('test-uid', { role: UserRole.ADMIN }, UserRole.RESIDENT)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProfile', () => {
    const profileDto: UserProfileDto = {
      displayName: 'Updated Profile',
      phoneNumber: '+1111111111',
    };

    it('should update user profile successfully', async () => {
      // Mock the first get call (check if user exists)
      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => mockUserDocument,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      const updatedDocument = {
        ...mockUserDocument,
        displayName: 'Updated Profile',
        phoneNumber: '+1111111111',
      };

      // Mock the second get call (return updated document)
      mockFirestore.get.mockResolvedValueOnce({
        data: () => updatedDocument,
      });

      const result = await service.updateProfile('test-uid', profileDto);

      expect(result.displayName).toBe('Updated Profile');
      expect(result.phoneNumber).toBe('+1111111111');
      expect(mockFirestore.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.updateProfile('non-existent-uid', profileDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user successfully', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      await service.deactivate('test-uid');

      expect(mockFirestore.update).toHaveBeenCalledWith({
        isActive: false,
        updatedAt: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.deactivate('non-existent-uid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reactivate', () => {
    it('should reactivate user successfully', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      await service.reactivate('test-uid');

      expect(mockFirestore.update).toHaveBeenCalledWith({
        isActive: true,
        updatedAt: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.reactivate('non-existent-uid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByRole', () => {
    it('should return users with specified role', async () => {
      mockFirestore.where.mockReturnThis();
      mockFirestore.get.mockResolvedValue({
        docs: [
          { data: () => mockUserDocument },
          { data: () => ({ ...mockUserDocument, uid: 'test-uid-2' }) },
        ],
      });

      const result = await service.findByRole(UserRole.RESIDENT);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe(UserRole.RESIDENT);
    });
  });

  describe('search', () => {
    it('should return users matching search term', async () => {
      mockFirestore.where.mockReturnThis();
      mockFirestore.limit.mockReturnThis();
      mockFirestore.get.mockResolvedValue({
        docs: [{ data: () => mockUserDocument }],
      });

      const result = await service.search('Test');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toContain('Test');
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
        data: () => mockUserDocument,
      });

      const result = await service.getUserPermissions('test-uid');

      expect(result).toBeDefined();
      expect(result.canManageUsers).toBe(false); // Resident role
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.getUserPermissions('non-existent-uid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFcmToken', () => {
    it('should update FCM token successfully', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      await service.updateFcmToken('test-uid', 'new-fcm-token');

      expect(mockFirestore.update).toHaveBeenCalledWith({
        fcmToken: 'new-fcm-token',
        updatedAt: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.updateFcmToken('non-existent-uid', 'token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFcmToken', () => {
    it('should remove FCM token successfully', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: true,
      });

      mockFirestore.update.mockResolvedValue(undefined);

      await service.removeFcmToken('test-uid');

      expect(mockFirestore.update).toHaveBeenCalledWith({
        fcmToken: expect.any(Object), // FieldValue.delete()
        updatedAt: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFirestore.get.mockResolvedValue({
        exists: false,
      });

      await expect(service.removeFcmToken('non-existent-uid')).rejects.toThrow(NotFoundException);
    });
  });
});