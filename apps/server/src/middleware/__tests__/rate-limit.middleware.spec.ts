import { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware, RateLimitConfigs } from '../rate-limit.middleware';
import { RateLimitException } from '../../exceptions/custom.exceptions';

describe('RateLimitMiddleware', () => {
  let middleware: RateLimitMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new RateLimitMiddleware({
      windowMs: 60000, // 1 minute
      maxRequests: 5,
    });

    mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
    } as any;

    mockResponse = {
      setHeader: jest.fn(),
      send: jest.fn(),
      statusCode: 200,
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    middleware.reset(); // Clear rate limit store
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
      ).resolves.not.toThrow();
    }

    expect(mockNext).toHaveBeenCalledTimes(5);
  });

  it('should block requests exceeding limit', async () => {
    // Make 5 requests (at the limit)
    for (let i = 0; i < 5; i++) {
      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    }

    // 6th request should throw
    await expect(
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext)
    ).rejects.toThrow(RateLimitException);
  });

  it('should set rate limit headers', async () => {
    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should use custom key generator', async () => {
    const customMiddleware = new RateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (req) => req.headers?.['x-user-id'] as string || 'anonymous',
    });

    const req1 = { ...mockRequest, headers: { 'x-user-id': 'user1' } };
    const req2 = { ...mockRequest, headers: { 'x-user-id': 'user2' } };

    // Each user should have their own limit
    await customMiddleware.use(req1 as Request, mockResponse as Response, mockNext);
    await customMiddleware.use(req1 as Request, mockResponse as Response, mockNext);
    await customMiddleware.use(req2 as Request, mockResponse as Response, mockNext);
    await customMiddleware.use(req2 as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(4);

    // Third request from user1 should fail
    await expect(
      customMiddleware.use(req1 as Request, mockResponse as Response, mockNext)
    ).rejects.toThrow(RateLimitException);
  });

  it('should reset after window expires', async () => {
    const shortWindowMiddleware = new RateLimitMiddleware({
      windowMs: 100, // 100ms
      maxRequests: 1,
      blockDuration: 50, // Short block duration for testing
    });

    // Make one request
    await shortWindowMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    // Second request should fail
    await expect(
      shortWindowMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext)
    ).rejects.toThrow(RateLimitException);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should allow request again
    await expect(
      shortWindowMiddleware.use(mockRequest as Request, mockResponse as Response, mockNext)
    ).resolves.not.toThrow();
  });

  it('should handle skipSuccessfulRequests option', async () => {
    const skipSuccessMiddleware = new RateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 2,
      skipSuccessfulRequests: true,
    });

    // Mock successful response
    const successResponse = {
      ...mockResponse,
      statusCode: 200,
      send: jest.fn().mockImplementation((body: any) => {
        successResponse.statusCode = 200;
        return body;
      }),
    };

    // Make requests that will be successful
    await skipSuccessMiddleware.use(mockRequest as Request, successResponse as Response, mockNext);
    await skipSuccessMiddleware.use(mockRequest as Request, successResponse as Response, mockNext);

    // Simulate sending responses (which should decrement counters)
    (successResponse.send as jest.Mock).mock.calls.forEach(call => {
      call[0]; // Trigger the send function
    });

    // Should still allow more requests since successful ones were skipped
    await expect(
      skipSuccessMiddleware.use(mockRequest as Request, successResponse as Response, mockNext)
    ).resolves.not.toThrow();
  });

  it('should provide status information', async () => {
    const key = 'unknown:0'; // Updated to match the new key format
    
    // Initial status
    let status = middleware.getStatus(key);
    expect(status.count).toBe(0);
    expect(status.remaining).toBe(5);

    // After one request
    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    status = middleware.getStatus(key);
    expect(status.count).toBe(1);
    expect(status.remaining).toBe(4);
  });

  it('should handle manual reset', async () => {
    const key = 'unknown:0'; // Updated to match the new key format

    // Make some requests
    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    let status = middleware.getStatus(key);
    expect(status.count).toBe(2);

    // Reset specific key
    middleware.reset(key);
    status = middleware.getStatus(key);
    expect(status.count).toBe(0);
  });

  describe('Predefined Configurations', () => {
    it('should have AUTH configuration', () => {
      expect(RateLimitConfigs.AUTH).toEqual(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          maxRequests: 5,
          skipSuccessfulRequests: true,
          blockDuration: 30 * 60 * 1000,
          progressiveDelay: true,
        })
      );
    });

    it('should have API configuration', () => {
      expect(RateLimitConfigs.API).toEqual(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          maxRequests: 100,
          blockDuration: 15 * 60 * 1000,
          progressiveDelay: true,
        })
      );
    });

    it('should have GENERAL configuration', () => {
      expect(RateLimitConfigs.GENERAL).toEqual(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          maxRequests: 1000,
          blockDuration: 5 * 60 * 1000,
        })
      );
    });

    it('should have PASSWORD_RESET configuration', () => {
      expect(RateLimitConfigs.PASSWORD_RESET).toEqual(
        expect.objectContaining({
          windowMs: 60 * 60 * 1000,
          maxRequests: 3,
          blockDuration: 2 * 60 * 60 * 1000,
          keyGenerator: expect.any(Function),
        })
      );
    });
  });
});