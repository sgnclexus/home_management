import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { ValidationError } from 'class-validator';
import { GlobalExceptionFilter } from '../global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'x-request-id': 'test-request-id',
      },
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle HttpException correctly', () => {
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Bad Request',
      code: 'BAD_REQUEST',
      details: undefined,
      requestId: 'test-request-id',
    });
  });

  it('should handle HttpException with object response', () => {
    const exceptionResponse = {
      message: ['field1 is required', 'field2 is invalid'],
      code: 'VALIDATION_FAILED',
    };
    const exception = new HttpException(exceptionResponse, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: ['field1 is required', 'field2 is invalid'],
      code: 'VALIDATION_FAILED',
      details: exceptionResponse,
      requestId: 'test-request-id',
    });
  });

  it('should handle ValidationError', () => {
    const validationError = new ValidationError();
    validationError.property = 'email';
    validationError.constraints = {
      isEmail: 'email must be a valid email',
      isNotEmpty: 'email should not be empty',
    };

    filter.catch(validationError, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        email: ['email must be a valid email', 'email should not be empty'],
      },
      requestId: 'test-request-id',
    });
  });

  it('should handle nested ValidationError', () => {
    const parentError = new ValidationError();
    parentError.property = 'user';
    
    const childError = new ValidationError();
    childError.property = 'email';
    childError.constraints = {
      isEmail: 'email must be a valid email',
    };
    
    parentError.children = [childError];

    filter.catch(parentError, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {
          'user.email': ['email must be a valid email'],
        },
      })
    );
  });

  it('should handle UnauthorizedError', () => {
    const error = new Error('unauthorized access');
    error.name = 'UnauthorizedError';

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 401,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Unauthorized access',
      code: 'UNAUTHORIZED',
      requestId: 'test-request-id',
    });
  });

  it('should handle ForbiddenError', () => {
    const error = new Error('forbidden resource');
    error.name = 'ForbiddenError';

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 403,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Access forbidden',
      code: 'FORBIDDEN',
      requestId: 'test-request-id',
    });
  });

  it('should handle NotFoundError', () => {
    const error = new Error('resource not found');
    error.name = 'NotFoundError';

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 404,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Resource not found',
      code: 'NOT_FOUND',
      requestId: 'test-request-id',
    });
  });

  it('should handle unknown errors as internal server error', () => {
    const error = new Error('Unknown error');

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId: 'test-request-id',
    });
  });

  it('should handle non-Error objects', () => {
    const error = 'string error';

    filter.catch(error, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: '/test',
      method: 'GET',
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId: 'test-request-id',
    });
  });

  it('should log errors with appropriate level', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    const consoleLog = jest.spyOn(console, 'log').mockImplementation();

    // Test 500 error (should use console.error)
    const serverError = new HttpException('Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    filter.catch(serverError, mockArgumentsHost as ArgumentsHost);
    expect(consoleError).toHaveBeenCalled();

    // Reset mocks
    consoleError.mockClear();
    consoleWarn.mockClear();
    consoleLog.mockClear();

    // Test 400 error (should use console.warn)
    const clientError = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    filter.catch(clientError, mockArgumentsHost as ArgumentsHost);
    expect(consoleWarn).toHaveBeenCalled();

    // Reset mocks
    consoleError.mockClear();
    consoleWarn.mockClear();
    consoleLog.mockClear();

    // Test 200 response (should use console.log)
    const successResponse = new HttpException('OK', HttpStatus.OK);
    filter.catch(successResponse, mockArgumentsHost as ArgumentsHost);
    expect(consoleLog).toHaveBeenCalled();

    // Restore mocks
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    consoleLog.mockRestore();
  });

  it('should handle request without x-request-id header', () => {
    mockRequest.headers = { 'user-agent': 'test-agent' };
    
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: undefined,
      })
    );
  });

  it('should get correct error codes for different HTTP statuses', () => {
    const testCases = [
      { status: HttpStatus.UNAUTHORIZED, expectedCode: 'UNAUTHORIZED' },
      { status: HttpStatus.FORBIDDEN, expectedCode: 'FORBIDDEN' },
      { status: HttpStatus.NOT_FOUND, expectedCode: 'NOT_FOUND' },
      { status: HttpStatus.CONFLICT, expectedCode: 'CONFLICT' },
      { status: HttpStatus.UNPROCESSABLE_ENTITY, expectedCode: 'VALIDATION_ERROR' },
      { status: HttpStatus.TOO_MANY_REQUESTS, expectedCode: 'RATE_LIMIT_EXCEEDED' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, expectedCode: 'INTERNAL_SERVER_ERROR' },
      { status: 418, expectedCode: 'UNKNOWN_ERROR' }, // I'm a teapot
    ];

    testCases.forEach(({ status, expectedCode }) => {
      const exception = new HttpException('Test', status);
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: expectedCode,
        })
      );
    });
  });
});