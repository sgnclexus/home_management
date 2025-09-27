import { FirebaseConfig, FirebaseAdminConfig } from '@home-management/types';

/**
 * Validates Firebase client configuration
 */
export const validateFirebaseConfig = (config: Partial<FirebaseConfig>): void => {
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(
      `Missing required Firebase configuration: ${missingFields.join(', ')}. ` +
      'Please check your environment variables.'
    );
  }
};

/**
 * Validates Firebase Admin SDK configuration
 */
export const validateFirebaseAdminConfig = (config: Partial<FirebaseAdminConfig>): void => {
  const requiredFields: (keyof FirebaseAdminConfig)[] = [
    'projectId',
    'clientEmail',
    'privateKey',
  ];

  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(
      `Missing required Firebase Admin configuration: ${missingFields.join(', ')}. ` +
      'Please check your environment variables.'
    );
  }
};

/**
 * Formats Firebase private key for proper usage
 */
export const formatFirebasePrivateKey = (privateKey: string): string => {
  return privateKey.replace(/\\n/g, '\n');
};

/**
 * Creates Firebase configuration from environment variables
 */
export const createFirebaseConfigFromEnv = (): FirebaseConfig => {
  const config: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  validateFirebaseConfig(config);
  return config;
};

/**
 * Creates Firebase Admin configuration from environment variables
 */
export const createFirebaseAdminConfigFromEnv = (): FirebaseAdminConfig => {
  const config: FirebaseAdminConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: formatFirebasePrivateKey(process.env.FIREBASE_PRIVATE_KEY!),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  };

  validateFirebaseAdminConfig(config);
  return config;
};