import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UsersService } from '../modules/users/users.service';

enum UserRole {
  ADMIN = 'admin',
  VIGILANCE = 'vigilance',
  RESIDENT = 'resident',
  SECURITY = 'security',
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let usersService: UsersService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockUsersService = {
    findByUid: jest.fn(),
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', async () => {
    const mockRequest = {
      user: { uid: 'test-uid' },
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(null);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });

  it('should allow access when user has required role', async () => {
    const mockRequest: any = {
      user: { uid: 'test-uid' },
    };

    const mockUserProfile = {
      uid: 'test-uid',
      role: UserRole.ADMIN,
      email: 'admin@example.com',
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (mockUsersService.findByUid as jest.Mock).mockResolvedValue(mockUserProfile);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(mockRequest.userProfile).toEqual(mockUserProfile);
  });

  it('should throw ForbiddenException when user does not have required role', async () => {
    const mockRequest = {
      user: { uid: 'test-uid' },
    };

    const mockUserProfile = {
      uid: 'test-uid',
      role: UserRole.RESIDENT,
      email: 'resident@example.com',
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (mockUsersService.findByUid as jest.Mock).mockResolvedValue(mockUserProfile);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not authenticated', async () => {
    const mockRequest = {};

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user profile is not found', async () => {
    const mockRequest = {
      user: { uid: 'test-uid' },
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    (mockUsersService.findByUid as jest.Mock).mockResolvedValue(null);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(ForbiddenException);
  });
});