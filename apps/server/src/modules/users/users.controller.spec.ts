import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../guards/firebase-auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { UserRole, User, CreateUserDto } from '@home-management/types';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser: User = {
    id: 'test-uid',
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    role: UserRole.ADMIN,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn(),
    findByRole: jest.fn(),
    findByUid: jest.fn(),
    update: jest.fn(),
    updateRole: jest.fn(),
    updateProfile: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    getUserPermissions: jest.fn(),
    updateFcmToken: jest.fn(),
    removeFcmToken: jest.fn(),
  };

  const mockFirebaseAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockRolesGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
    .overrideGuard(FirebaseAuthGuard)
    .useValue(mockFirebaseAuthGuard)
    .overrideGuard(RolesGuard)
    .useValue(mockRolesGuard)
    .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      displayName: 'Test User',
      role: UserRole.RESIDENT,
    };

    it('should create a user', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(result).toBe(mockUser);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockResponse = {
        users: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockUsersService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll({ page: 1, limit: 10 });

      expect(result).toBe(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });
  });

  describe('search', () => {
    it('should search users', async () => {
      mockUsersService.search.mockResolvedValue([mockUser]);

      const result = await controller.search('test', 10);

      expect(result).toEqual([mockUser]);
      expect(service.search).toHaveBeenCalledWith('test', 10);
    });

    it('should throw BadRequestException if search term is missing', async () => {
      await expect(controller.search('', 10)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByRole', () => {
    it('should return users by role', async () => {
      mockUsersService.findByRole.mockResolvedValue([mockUser]);

      const result = await controller.findByRole(UserRole.ADMIN);

      expect(result).toEqual([mockUser]);
      expect(service.findByRole).toHaveBeenCalledWith(UserRole.ADMIN);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const result = await controller.getCurrentUser(mockUser);

      expect(result).toBe(mockUser);
    });
  });

  describe('getCurrentUserPermissions', () => {
    it('should return current user permissions', async () => {
      const mockPermissions = { canManageUsers: true };
      mockUsersService.getUserPermissions.mockResolvedValue(mockPermissions);

      const result = await controller.getCurrentUserPermissions(mockUser);

      expect(result).toBe(mockPermissions);
      expect(service.getUserPermissions).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  describe('updateCurrentUserProfile', () => {
    it('should update current user profile', async () => {
      const profileDto = { displayName: 'Updated Name' };
      const updatedUser = { ...mockUser, displayName: 'Updated Name' };
      mockUsersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateCurrentUserProfile(mockUser, profileDto);

      expect(result).toBe(updatedUser);
      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.uid, profileDto);
    });
  });

  describe('updateFcmToken', () => {
    it('should update FCM token', async () => {
      const fcmTokenDto = { fcmToken: 'new-token' };
      mockUsersService.updateFcmToken.mockResolvedValue(undefined);

      await controller.updateFcmToken(mockUser, fcmTokenDto);

      expect(service.updateFcmToken).toHaveBeenCalledWith(mockUser.uid, 'new-token');
    });
  });

  describe('removeFcmToken', () => {
    it('should remove FCM token', async () => {
      mockUsersService.removeFcmToken.mockResolvedValue(undefined);

      await controller.removeFcmToken(mockUser);

      expect(service.removeFcmToken).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  describe('findOne', () => {
    it('should return user by ID', async () => {
      mockUsersService.findByUid.mockResolvedValue(mockUser);

      const result = await controller.findOne('test-uid');

      expect(result).toBe(mockUser);
      expect(service.findByUid).toHaveBeenCalledWith('test-uid');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.findByUid.mockResolvedValue(null);

      await expect(controller.findOne('non-existent-uid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const updateDto = { displayName: 'Updated Name' };
      const updatedUser = { ...mockUser, displayName: 'Updated Name' };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('test-uid', updateDto);

      expect(result).toBe(updatedUser);
      expect(service.update).toHaveBeenCalledWith('test-uid', updateDto);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      const roleDto = { role: UserRole.VIGILANCE };
      const updatedUser = { ...mockUser, role: UserRole.VIGILANCE };
      mockUsersService.updateRole.mockResolvedValue(updatedUser);

      const result = await controller.updateRole('test-uid', roleDto, mockUser);

      expect(result).toBe(updatedUser);
      expect(service.updateRole).toHaveBeenCalledWith('test-uid', roleDto, mockUser.role);
    });
  });

  describe('deactivate', () => {
    it('should deactivate user', async () => {
      mockUsersService.deactivate.mockResolvedValue(undefined);

      await controller.deactivate('test-uid');

      expect(service.deactivate).toHaveBeenCalledWith('test-uid');
    });
  });

  describe('reactivate', () => {
    it('should reactivate user', async () => {
      mockUsersService.reactivate.mockResolvedValue(undefined);

      await controller.reactivate('test-uid');

      expect(service.reactivate).toHaveBeenCalledWith('test-uid');
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      const mockPermissions = { canManageUsers: false };
      mockUsersService.getUserPermissions.mockResolvedValue(mockPermissions);

      const result = await controller.getUserPermissions('test-uid');

      expect(result).toBe(mockPermissions);
      expect(service.getUserPermissions).toHaveBeenCalledWith('test-uid');
    });
  });

  describe('getUsersStatus', () => {
    it('should return service status', () => {
      const result = controller.getUsersStatus();

      expect(result).toHaveProperty('message', 'Users service is running');
      expect(result).toHaveProperty('timestamp');
    });
  });
});