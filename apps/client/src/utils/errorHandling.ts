import { AxiosError } from 'axios';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  statusCode?: number;
}

export interface ErrorHandler {
  handleAuthError(error: AuthError): void;
  handleNetworkError(error: NetworkError): void;
  handleValidationError(error: ValidationError): void;
  handleServerError(error: ServerError): void;
}

export class AuthError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public code: string = 'NETWORK_ERROR') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields?: Record<string, string>, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServerError extends Error {
  constructor(message: string, public statusCode: number, public code: string = 'SERVER_ERROR') {
    super(message);
    this.name = 'ServerError';
  }
}

export class ApiErrorHandler implements ErrorHandler {
  private notificationService?: {
    showError: (message: string) => void;
    showWarning: (message: string) => void;
  };

  constructor(notificationService?: { showError: (message: string) => void; showWarning: (message: string) => void }) {
    this.notificationService = notificationService;
  }

  handleAuthError(error: AuthError): void {
    console.error('Authentication error:', error);
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
    
    this.notificationService?.showError('Please log in to continue');
  }

  handleNetworkError(error: NetworkError): void {
    console.error('Network error:', error);
    this.notificationService?.showError('Network connection error. Please check your internet connection.');
  }

  handleValidationError(error: ValidationError): void {
    console.error('Validation error:', error);
    this.notificationService?.showWarning(error.message);
  }

  handleServerError(error: ServerError): void {
    console.error('Server error:', error);
    
    const message = error.statusCode >= 500 
      ? 'Server error. Please try again later.'
      : error.message;
    
    this.notificationService?.showError(message);
  }
}

export const parseApiError = (error: unknown): ApiError => {
  // Check if it's an AxiosError by checking properties
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError;
    const response = axiosError.response;
    
    return {
      code: response?.data?.code || 'API_ERROR',
      message: response?.data?.message || axiosError.message,
      details: response?.data?.details,
      timestamp: new Date(),
      statusCode: response?.status,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date(),
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    timestamp: new Date(),
  };
};

export const createErrorFromApiResponse = (error: unknown): Error => {
  const apiError = parseApiError(error);
  
  if (apiError.statusCode === 401 || apiError.code === 'UNAUTHORIZED') {
    return new AuthError(apiError.message, apiError.code);
  }
  
  if (apiError.statusCode === 400 || apiError.code === 'VALIDATION_ERROR') {
    return new ValidationError(apiError.message, apiError.details, apiError.code);
  }
  
  if (!apiError.statusCode || apiError.statusCode === 0) {
    return new NetworkError(apiError.message, apiError.code);
  }
  
  if (apiError.statusCode >= 500) {
    return new ServerError(apiError.message, apiError.statusCode, apiError.code);
  }
  
  return new Error(apiError.message);
};

export const handleApiError = (error: unknown, errorHandler: ErrorHandler): void => {
  const processedError = createErrorFromApiResponse(error);
  
  if (processedError instanceof AuthError) {
    errorHandler.handleAuthError(processedError);
  } else if (processedError instanceof NetworkError) {
    errorHandler.handleNetworkError(processedError);
  } else if (processedError instanceof ValidationError) {
    errorHandler.handleValidationError(processedError);
  } else if (processedError instanceof ServerError) {
    errorHandler.handleServerError(processedError);
  } else {
    console.error('Unhandled error:', processedError);
  }
};

// Hook for using error handling in components
export const useErrorHandler = () => {
  const errorHandler = new ApiErrorHandler({
    showError: (message: string) => {
      // This would integrate with your notification system
      console.error(message);
    },
    showWarning: (message: string) => {
      console.warn(message);
    },
  });

  return {
    handleError: (error: unknown) => handleApiError(error, errorHandler),
    parseError: parseApiError,
  };
};