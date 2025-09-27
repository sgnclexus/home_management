import { AxiosError } from 'axios';
import {
  ApiErrorHandler,
  AuthError,
  NetworkError,
  ValidationError,
  ServerError,
  parseApiError,
  createErrorFromApiResponse,
  handleApiError,
  useErrorHandler,
} from '../errorHandling';

// Mock console methods
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('Error Classes', () => {
  it('creates AuthError with correct properties', () => {
    const error = new AuthError('Authentication failed', 'AUTH_FAILED');
    
    expect(error.name).toBe('AuthError');
    expect(error.message).toBe('Authentication failed');
    expect(error.code).toBe('AUTH_FAILED');
  });

  it('creates NetworkError with default code', () => {
    const error = new NetworkError('Connection failed');
    
    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('creates ValidationError with fields', () => {
    const fields = { email: 'Invalid email format' };
    const error = new ValidationError('Validation failed', fields);
    
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Validation failed');
    expect(error.fields).toEqual(fields);
  });

  it('creates ServerError with status code', () => {
    const error = new ServerError('Internal server error', 500);
    
    expect(error.name).toBe('ServerError');
    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
  });
});

describe('ApiErrorHandler', () => {
  let mockNotificationService: {
    showError: jest.Mock;
    showWarning: jest.Mock;
  };
  let errorHandler: ApiErrorHandler;

  beforeEach(() => {
    mockNotificationService = {
      showError: jest.fn(),
      showWarning: jest.fn(),
    };
    errorHandler = new ApiErrorHandler(mockNotificationService);
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('handles auth errors by redirecting to login', () => {
    const authError = new AuthError('Token expired');
    
    errorHandler.handleAuthError(authError);
    
    expect(window.location.href).toBe('/auth');
    expect(mockNotificationService.showError).toHaveBeenCalledWith('Please log in to continue');
    expect(mockConsoleError).toHaveBeenCalledWith('Authentication error:', authError);
  });

  it('handles network errors with appropriate message', () => {
    const networkError = new NetworkError('Connection timeout');
    
    errorHandler.handleNetworkError(networkError);
    
    expect(mockNotificationService.showError).toHaveBeenCalledWith(
      'Network connection error. Please check your internet connection.'
    );
    expect(mockConsoleError).toHaveBeenCalledWith('Network error:', networkError);
  });

  it('handles validation errors with warning', () => {
    const validationError = new ValidationError('Invalid input');
    
    errorHandler.handleValidationError(validationError);
    
    expect(mockNotificationService.showWarning).toHaveBeenCalledWith('Invalid input');
    expect(mockConsoleError).toHaveBeenCalledWith('Validation error:', validationError);
  });

  it('handles server errors with appropriate message for 5xx errors', () => {
    const serverError = new ServerError('Database connection failed', 500);
    
    errorHandler.handleServerError(serverError);
    
    expect(mockNotificationService.showError).toHaveBeenCalledWith(
      'Server error. Please try again later.'
    );
    expect(mockConsoleError).toHaveBeenCalledWith('Server error:', serverError);
  });

  it('handles server errors with original message for 4xx errors', () => {
    const serverError = new ServerError('Bad request', 400);
    
    errorHandler.handleServerError(serverError);
    
    expect(mockNotificationService.showError).toHaveBeenCalledWith('Bad request');
  });

  it('works without notification service', () => {
    const handlerWithoutNotifications = new ApiErrorHandler();
    const authError = new AuthError('Token expired');
    
    expect(() => {
      handlerWithoutNotifications.handleAuthError(authError);
    }).not.toThrow();
  });
});

describe('parseApiError', () => {
  it('parses AxiosError correctly', () => {
    const axiosError = {
      response: {
        status: 400,
        data: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'email' },
        },
      },
      message: 'Request failed',
    } as AxiosError;

    const result = parseApiError(axiosError);

    expect(result).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { field: 'email' },
      timestamp: expect.any(Date),
      statusCode: 400,
    });
  });

  it('handles AxiosError without response data', () => {
    const axiosError = {
      message: 'Network Error',
    } as AxiosError;

    const result = parseApiError(axiosError);

    expect(result).toEqual({
      code: 'API_ERROR',
      message: 'Network Error',
      details: undefined,
      timestamp: expect.any(Date),
      statusCode: undefined,
    });
  });

  it('handles regular Error objects', () => {
    const error = new Error('Something went wrong');

    const result = parseApiError(error);

    expect(result).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong',
      timestamp: expect.any(Date),
    });
  });

  it('handles unknown error types', () => {
    const result = parseApiError('string error');

    expect(result).toEqual({
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      timestamp: expect.any(Date),
    });
  });
});

describe('createErrorFromApiResponse', () => {
  it('creates AuthError for 401 status', () => {
    const axiosError = {
      response: { status: 401, data: { message: 'Unauthorized' } },
    } as AxiosError;

    const result = createErrorFromApiResponse(axiosError);

    expect(result).toBeInstanceOf(AuthError);
    expect(result.message).toBe('Unauthorized');
  });

  it('creates ValidationError for 400 status', () => {
    const axiosError = {
      response: { 
        status: 400, 
        data: { 
          message: 'Validation failed',
          details: { email: 'Invalid format' }
        } 
      },
    } as AxiosError;

    const result = createErrorFromApiResponse(axiosError);

    expect(result).toBeInstanceOf(ValidationError);
    expect(result.message).toBe('Validation failed');
    expect((result as ValidationError).fields).toEqual({ email: 'Invalid format' });
  });

  it('creates NetworkError for no status code', () => {
    const axiosError = {
      message: 'Network Error',
    } as AxiosError;

    const result = createErrorFromApiResponse(axiosError);

    expect(result).toBeInstanceOf(NetworkError);
    expect(result.message).toBe('Network Error');
  });

  it('creates ServerError for 5xx status', () => {
    const axiosError = {
      response: { status: 500, data: { message: 'Internal Server Error' } },
    } as AxiosError;

    const result = createErrorFromApiResponse(axiosError);

    expect(result).toBeInstanceOf(ServerError);
    expect(result.message).toBe('Internal Server Error');
    expect((result as ServerError).statusCode).toBe(500);
  });

  it('creates generic Error for other status codes', () => {
    const axiosError = {
      response: { status: 404, data: { message: 'Not Found' } },
    } as AxiosError;

    const result = createErrorFromApiResponse(axiosError);

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Not Found');
  });
});

describe('handleApiError', () => {
  let mockErrorHandler: {
    handleAuthError: jest.Mock;
    handleNetworkError: jest.Mock;
    handleValidationError: jest.Mock;
    handleServerError: jest.Mock;
  };

  beforeEach(() => {
    mockErrorHandler = {
      handleAuthError: jest.fn(),
      handleNetworkError: jest.fn(),
      handleValidationError: jest.fn(),
      handleServerError: jest.fn(),
    };
  });

  it('calls appropriate handler for AuthError', () => {
    const axiosError = {
      response: { status: 401, data: { message: 'Unauthorized' } },
    } as AxiosError;

    handleApiError(axiosError, mockErrorHandler);

    expect(mockErrorHandler.handleAuthError).toHaveBeenCalledWith(
      expect.any(AuthError)
    );
  });

  it('calls appropriate handler for NetworkError', () => {
    const axiosError = { message: 'Network Error' } as AxiosError;

    handleApiError(axiosError, mockErrorHandler);

    expect(mockErrorHandler.handleNetworkError).toHaveBeenCalledWith(
      expect.any(NetworkError)
    );
  });

  it('calls appropriate handler for ValidationError', () => {
    const axiosError = {
      response: { status: 400, data: { message: 'Validation failed' } },
    } as AxiosError;

    handleApiError(axiosError, mockErrorHandler);

    expect(mockErrorHandler.handleValidationError).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );
  });

  it('calls appropriate handler for ServerError', () => {
    const axiosError = {
      response: { status: 500, data: { message: 'Server error' } },
    } as AxiosError;

    handleApiError(axiosError, mockErrorHandler);

    expect(mockErrorHandler.handleServerError).toHaveBeenCalledWith(
      expect.any(ServerError)
    );
  });

  it('logs unhandled errors', () => {
    const genericError = new Error('Generic error');

    handleApiError(genericError, mockErrorHandler);

    expect(mockConsoleError).toHaveBeenCalledWith('Unhandled error:', genericError);
  });
});

describe('useErrorHandler', () => {
  it('returns error handling functions', () => {
    const { handleError, parseError } = useErrorHandler();

    expect(typeof handleError).toBe('function');
    expect(typeof parseError).toBe('function');
  });

  it('handles errors without throwing', () => {
    const { handleError } = useErrorHandler();
    const error = new Error('Test error');

    expect(() => {
      handleError(error);
    }).not.toThrow();
  });
});