import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    storage: HealthCheck;
    auth: HealthCheck;
    payments: HealthCheck;
    notifications: HealthCheck;
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  error?: string;
  details?: Record<string, any>;
}

@Injectable()
export class HealthCheckService {
  constructor(private configService: ConfigService) {}

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkAuth(),
      this.checkPayments(),
      this.checkNotifications(),
    ]);

    const [database, storage, auth, payments, notifications] = checks.map(
      (result) => result.status === 'fulfilled' ? result.value : this.createFailedCheck(result.reason)
    );

    const overallStatus = this.determineOverallStatus([
      database, storage, auth, payments, notifications
    ]);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: this.configService.get('NODE_ENV', 'development'),
      uptime: process.uptime(),
      checks: {
        database,
        storage,
        auth,
        payments,
        notifications,
      },
      metrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test Firestore connection
      const db = admin.firestore();
      const testDoc = db.collection('health_check').doc('test');
      
      await testDoc.set({ 
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        test: true 
      });
      
      const doc = await testDoc.get();
      await testDoc.delete();
      
      if (!doc.exists) {
        throw new Error('Failed to read test document');
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          connection: 'active',
          readWrite: 'operational',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connection: 'failed',
          readWrite: 'failed',
        },
      };
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test Firebase Storage connection
      const bucket = admin.storage().bucket();
      const file = bucket.file('health_check/test.txt');
      
      await file.save('health check test', {
        metadata: {
          contentType: 'text/plain',
        },
      });
      
      const [exists] = await file.exists();
      await file.delete();
      
      if (!exists) {
        throw new Error('Failed to verify file upload');
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          connection: 'active',
          readWrite: 'operational',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connection: 'failed',
          readWrite: 'failed',
        },
      };
    }
  }

  private async checkAuth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test Firebase Auth connection
      const auth = admin.auth();
      
      // Try to list users (limited to 1 to minimize impact)
      const listUsersResult = await auth.listUsers(1);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          connection: 'active',
          userCount: listUsersResult.users.length,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connection: 'failed',
        },
      };
    }
  }

  private async checkPayments(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test Stripe connection
      const stripeKey = this.configService.get('STRIPE_SECRET_KEY');
      if (!stripeKey) {
        throw new Error('Stripe not configured');
      }

      // Simple API call to verify Stripe connection
      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.status}`);
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          stripe: 'operational',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          stripe: 'failed',
        },
      };
    }
  }

  private async checkNotifications(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test FCM connection by validating configuration
      const messaging = admin.messaging();
      
      // Validate FCM configuration without sending actual message
      const fcmKey = this.configService.get('FCM_SERVER_KEY');
      if (!fcmKey) {
        throw new Error('FCM not configured');
      }

      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          fcm: 'configured',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          fcm: 'failed',
        },
      };
    }
  }

  private createFailedCheck(error: any): HealthCheck {
    return {
      status: 'unhealthy',
      responseTime: 0,
      error: error?.message || 'Unknown error',
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount > 0) {
      // If database or auth is unhealthy, system is unhealthy
      const criticalChecks = checks.slice(0, 3); // database, storage, auth
      if (criticalChecks.some(check => check.status === 'unhealthy')) {
        return 'unhealthy';
      }
      return 'degraded';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  async getMetrics(): Promise<{
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    timestamp: string;
  }> {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    };
  }
}