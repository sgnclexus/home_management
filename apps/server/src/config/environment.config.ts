import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface EnvironmentConfig {
  // Application
  nodeEnv: string;
  port: number;
  apiVersion: string;
  
  // Firebase
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  firebaseDatabaseUrl: string;
  
  // Payment Gateways
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
  
  // Security
  jwtSecret: string;
  encryptionKey: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;
  
  // Notifications
  fcmServerKey: string;
  vapidPrivateKey: string;
  
  // Monitoring
  sentryDsn?: string;
  logLevel: string;
  
  // Database
  enableFirestoreEmulator: boolean;
  firestoreEmulatorHost?: string;
  firestoreEmulatorPort?: number;
}

@Injectable()
export class EnvironmentConfigService {
  private readonly config: EnvironmentConfig;

  constructor(private nestConfigService: NestConfigService) {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): EnvironmentConfig {
    return {
      // Application
      nodeEnv: this.nestConfigService.get<string>('NODE_ENV', 'development'),
      port: this.nestConfigService.get<number>('PORT', 3001),
      apiVersion: this.nestConfigService.get<string>('API_VERSION', 'v1'),
      
      // Firebase
      firebaseProjectId: this.nestConfigService.get<string>('FIREBASE_PROJECT_ID'),
      firebaseClientEmail: this.nestConfigService.get<string>('FIREBASE_CLIENT_EMAIL'),
      firebasePrivateKey: this.nestConfigService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      firebaseDatabaseUrl: this.nestConfigService.get<string>('FIREBASE_DATABASE_URL'),
      
      // Payment Gateways
      stripeSecretKey: this.nestConfigService.get<string>('STRIPE_SECRET_KEY'),
      stripeWebhookSecret: this.nestConfigService.get<string>('STRIPE_WEBHOOK_SECRET'),
      paypalClientId: this.nestConfigService.get<string>('PAYPAL_CLIENT_ID'),
      paypalClientSecret: this.nestConfigService.get<string>('PAYPAL_CLIENT_SECRET'),
      paypalWebhookId: this.nestConfigService.get<string>('PAYPAL_WEBHOOK_ID'),
      
      // Security
      jwtSecret: this.nestConfigService.get<string>('JWT_SECRET'),
      encryptionKey: this.nestConfigService.get<string>('ENCRYPTION_KEY'),
      corsOrigins: this.nestConfigService.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(','),
      rateLimitMax: this.nestConfigService.get<number>('RATE_LIMIT_MAX', 100),
      rateLimitWindowMs: this.nestConfigService.get<number>('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
      
      // Notifications
      fcmServerKey: this.nestConfigService.get<string>('FCM_SERVER_KEY'),
      vapidPrivateKey: this.nestConfigService.get<string>('VAPID_PRIVATE_KEY'),
      
      // Monitoring
      sentryDsn: this.nestConfigService.get<string>('SENTRY_DSN'),
      logLevel: this.nestConfigService.get<string>('LOG_LEVEL', 'info'),
      
      // Database
      enableFirestoreEmulator: this.nestConfigService.get<string>('NODE_ENV') === 'development',
      firestoreEmulatorHost: this.nestConfigService.get<string>('FIRESTORE_EMULATOR_HOST', 'localhost'),
      firestoreEmulatorPort: this.nestConfigService.get<number>('FIRESTORE_EMULATOR_PORT', 8080),
    };
  }

  private validateConfiguration(): void {
    const requiredKeys: (keyof EnvironmentConfig)[] = [
      'firebaseProjectId',
      'firebaseClientEmail',
      'firebasePrivateKey',
      'jwtSecret',
      'encryptionKey'
    ];

    // In production, require payment and notification keys
    if (this.config.nodeEnv === 'production') {
      requiredKeys.push(
        'stripeSecretKey',
        'stripeWebhookSecret',
        'fcmServerKey',
        'vapidPrivateKey'
      );
    }

    const missingKeys = requiredKeys.filter(key => !this.config[key]);
    
    if (missingKeys.length > 0) {
      throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
    }

    // Validate Firebase private key format
    if (this.config.firebasePrivateKey && !this.config.firebasePrivateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('FIREBASE_PRIVATE_KEY must be a valid private key');
    }

    // Validate CORS origins
    if (this.config.nodeEnv === 'production' && this.config.corsOrigins.includes('*')) {
      throw new Error('CORS_ORIGINS cannot include wildcard (*) in production');
    }
  }

  get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }

  getAll(): EnvironmentConfig {
    return { ...this.config };
  }

  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  getFirebaseConfig() {
    return {
      projectId: this.config.firebaseProjectId,
      clientEmail: this.config.firebaseClientEmail,
      privateKey: this.config.firebasePrivateKey,
      databaseURL: this.config.firebaseDatabaseUrl,
    };
  }

  getStripeConfig() {
    return {
      secretKey: this.config.stripeSecretKey,
      webhookSecret: this.config.stripeWebhookSecret,
    };
  }

  getPayPalConfig() {
    return {
      clientId: this.config.paypalClientId,
      clientSecret: this.config.paypalClientSecret,
      webhookId: this.config.paypalWebhookId,
    };
  }

  getRateLimitConfig() {
    return {
      max: this.config.rateLimitMax,
      windowMs: this.config.rateLimitWindowMs,
    };
  }
}