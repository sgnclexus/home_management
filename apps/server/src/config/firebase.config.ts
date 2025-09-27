import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfigService {
  private app: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      // Get configuration from environment variables
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
      const databaseURL = this.configService.get<string>('FIREBASE_DATABASE_URL');

      // Validate required configuration
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          'Missing required Firebase configuration. Please check your environment variables: ' +
          'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
        );
      }

      // Initialize Firebase Admin SDK
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        databaseURL,
      });

      console.log(`Firebase Admin SDK initialized for project: ${projectId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize Firebase Admin SDK:', errorMessage);
      throw error;
    }
  }

  getApp(): admin.app.App {
    return this.app;
  }

  getAuth(): admin.auth.Auth {
    return admin.auth(this.app);
  }

  getFirestore(): admin.firestore.Firestore {
    return admin.firestore(this.app);
  }

  getMessaging(): admin.messaging.Messaging {
    return admin.messaging(this.app);
  }

  getProjectId(): string {
    return this.app.options.projectId!;
  }
}