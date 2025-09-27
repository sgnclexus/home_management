import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseConfigService } from '../config/firebase.config';

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let firebaseConfigService: FirebaseConfigService;

  const mockFirebaseConfigService = {
    getAuth: jest.fn().mockReturnValue({
      verifyIdToken: jest.fn(),
    }),
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
    }),
  } as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        {
          provide: FirebaseConfigService,
          useValue: mockFirebaseConfigService,
        },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
    firebaseConfigService = module.get<FirebaseConfigService>(FirebaseConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access with valid token', async () => {
    const mockRequest: any = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    };

    const mockDecodedToken = {
      uid: 'test-uid',
      email: 'test@example.com',
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockFirebaseConfigService.getAuth().verifyIdToken as jest.Mock).mockResolvedValue(mockDecodedToken);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(mockRequest.user).toEqual(mockDecodedToken);
  });

  it('should throw UnauthorizedException when no token provided', async () => {
    const mockRequest = {
      headers: {},
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
    (mockFirebaseConfigService.getAuth().verifyIdToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when authorization header format is invalid', async () => {
    const mockRequest = {
      headers: {
        authorization: 'InvalidFormat token',
      },
    };

    (mockExecutionContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(UnauthorizedException);
  });
});