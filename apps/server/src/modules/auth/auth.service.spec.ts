import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseConfigService } from '../../config/firebase.config';
import { UsersService } from '../users/users.service';

enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

describe('AuthService', () => {
  let service: AuthService;
  let firebaseConfigService: FirebaseConfigService;
  let usersService: UsersService;

  const mockFirebaseConfigService = {
    getAuth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
      updateUser: jest.fn(),
    }),
  };

  const mockUsersService = {
    findByUid: jest.fn(),
    create: jest.fn(),
    updateRole: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    firebaseConfigService = module.get<FirebaseConfigService>(FirebaseConfigService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const mockDecodedToken = { uid: 'test-uid', email: 'test@example.com' };
      (mockFirebaseConfigService.getAuth().verifyIdToken as jest.Mock).mockResolvedValue(mockDecodedToken);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual(mockDecodedToken);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (mockFirebaseConfigService.getAuth().verifyIdToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('registerUser', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test User',
        role: UserRole.RESIDENT,
        isActive: true,
      };

      (mockUsersService.findByUid as jest.Mock).mockResolvedValue(null);
      (mockUsersService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.registerUser('test-uid', userData);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...userData,
        uid: 'test-uid',
        role: UserRole.RESIDENT,
        isActive: true,
      });
    });

    it('should throw BadRequestException if user already exists', async () => {
      const userData = {
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const existingUser = { uid: 'test-uid', email: 'test@example.com' };
      (mockUsersService.findByUid as jest.Mock).mockResolvedValue(existingUser);

      await expect(service.registerUser('test-uid', userData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserProfile', () => {
    it('should return user profile', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        role: UserRole.RESIDENT,
      };

      (mockUsersService.findByUid as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getUserProfile('test-uid');

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (mockUsersService.findByUid as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserProfile('test-uid')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        role: UserRole.ADMIN,
      };

      (mockUsersService.updateRole as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.updateUserRole('test-uid', UserRole.ADMIN, UserRole.ADMIN);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.updateRole).toHaveBeenCalledWith('test-uid', UserRole.ADMIN);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      (mockUsersService.deactivate as jest.Mock).mockResolvedValue(undefined);
      (mockFirebaseConfigService.getAuth().updateUser as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deactivateUser('test-uid');

      expect(result).toEqual({ message: 'User deactivated successfully' });
      expect(mockUsersService.deactivate).toHaveBeenCalledWith('test-uid');
      expect(mockFirebaseConfigService.getAuth().updateUser).toHaveBeenCalledWith('test-uid', {
        disabled: true,
      });
    });
  });

  describe('reactivateUser', () => {
    it('should reactivate user successfully', async () => {
      (mockUsersService.reactivate as jest.Mock).mockResolvedValue(undefined);
      (mockFirebaseConfigService.getAuth().updateUser as jest.Mock).mockResolvedValue(undefined);

      const result = await service.reactivateUser('test-uid');

      expect(result).toEqual({ message: 'User reactivated successfully' });
      expect(mockUsersService.reactivate).toHaveBeenCalledWith('test-uid');
      expect(mockFirebaseConfigService.getAuth().updateUser).toHaveBeenCalledWith('test-uid', {
        disabled: false,
      });
    });
  });
});