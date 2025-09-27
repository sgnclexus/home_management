import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out development errors
      if (ENVIRONMENT === 'development') {
        console.error('Sentry Event:', event, hint);
      }
      
      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Skip Firebase timeout errors (handled by retry logic)
        if (error.message.includes('DEADLINE_EXCEEDED') || 
            error.message.includes('timeout')) {
          return null;
        }
        
        // Skip validation errors (handled by validation pipes)
        if (error.message.includes('ValidationError') || 
            error.message.includes('Bad Request')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      nodeProfilingIntegration(),
    ],
    
    // Release tracking
    release: process.env.npm_package_version || '1.0.0',
    
    // Server context
    initialScope: {
      tags: {
        component: 'backend',
        platform: 'node',
        runtime: 'firebase-functions',
      },
    },
  });
};

// Custom error reporting functions
export const reportError = (
  error: Error, 
  context?: Record<string, any>,
  user?: { id: string; email?: string; role?: string }
) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    if (user) {
      scope.setUser(user);
    }
    Sentry.captureException(error);
  });
};

export const reportMessage = (
  message: string, 
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
) => {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    Sentry.captureMessage(message, level);
  });
};

export const reportPaymentError = (
  error: Error,
  paymentId: string,
  userId: string,
  provider: string,
  amount: number
) => {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'payment_error');
    scope.setContext('payment', {
      paymentId,
      userId,
      provider,
      amount,
    });
    Sentry.captureException(error);
  });
};

export const reportSecurityIncident = (
  incident: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>
) => {
  Sentry.withScope((scope) => {
    scope.setTag('incident_type', 'security');
    scope.setLevel(severity === 'critical' ? 'fatal' : severity as Sentry.SeverityLevel);
    scope.setContext('security_incident', details);
    Sentry.captureMessage(`Security Incident: ${incident}`, 'error');
  });
};

export const addBreadcrumb = (
  message: string, 
  category: string, 
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
};

// Performance monitoring helpers
export const startTransaction = (name: string, op: string) => {
  return Sentry.startSpan({ name, op }, () => {});
};

export const measurePerformance = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  return Sentry.startSpan({ name, op: 'function' }, async () => {
    try {
      return await operation();
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  });
};