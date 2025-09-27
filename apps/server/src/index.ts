import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as functions from 'firebase-functions';
import express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { SecurityInterceptor } from './interceptors/security.interceptor';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

const server = express();

const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
    {
      logger: ['error', 'warn', 'log'],
    }
  );

  const configService = app.get(ConfigService);

  // Global configuration
  app.setGlobalPrefix('api');
  
  // CORS configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGINS')?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors will be configured in the app module
  // app.useGlobalInterceptors(
  //   new SecurityInterceptor(),
  //   new AuditLogInterceptor()
  // );

  return app.init();
};

createNestServer(server)
  .then(() => console.log('Nest Ready'))
  .catch(err => console.error('Nest broken', err));

// Firebase Functions export
export const api = functions
  .region('us-central1')
  .runWith({
    memory: '1GB',
    timeoutSeconds: 60,
    maxInstances: 100,
  })
  .https
  .onRequest(server);

// Health check function
export const health = functions
  .region('us-central1')
  .runWith({
    memory: '256MB',
    timeoutSeconds: 10,
  })
  .https
  .onRequest((req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  });

// Scheduled functions for maintenance tasks
export const dailyMaintenance = functions
  .region('us-central1')
  .runWith({
    memory: '512MB',
    timeoutSeconds: 300,
  })
  .pubsub
  .schedule('0 2 * * *') // Run daily at 2 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('Running daily maintenance tasks...');
    
    // Add maintenance tasks here:
    // - Clean up expired sessions
    // - Archive old audit logs
    // - Send payment reminders
    // - Update reservation statuses
    
    return null;
  });

// Payment reminder function
export const paymentReminders = functions
  .region('us-central1')
  .runWith({
    memory: '512MB',
    timeoutSeconds: 180,
  })
  .pubsub
  .schedule('0 9 * * 1') // Run every Monday at 9 AM
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('Sending payment reminders...');
    
    // Implementation for sending payment reminders
    // This would integrate with the notification service
    
    return null;
  });

// Firestore triggers for real-time updates
export const onPaymentUpdate = functions
  .region('us-central1')
  .firestore
  .document('payments/{paymentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Send notification if payment status changed
    if (before.status !== after.status) {
      console.log(`Payment ${context.params.paymentId} status changed from ${before.status} to ${after.status}`);
      
      // Trigger notification
      // This would integrate with the notification service
    }
    
    return null;
  });

export const onReservationCreate = functions
  .region('us-central1')
  .firestore
  .document('reservations/{reservationId}')
  .onCreate(async (snap, context) => {
    const reservation = snap.data();
    
    console.log(`New reservation created: ${context.params.reservationId}`);
    
    // Send confirmation notification
    // This would integrate with the notification service
    
    return null;
  });