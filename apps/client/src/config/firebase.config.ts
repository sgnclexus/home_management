import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';
import { FirebaseConfig } from '@home-management/types';

// Firebase configuration validation
const validateFirebaseConfig = (config: Partial<FirebaseConfig>): void => {
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

// Create Firebase configuration from environment variables
const createFirebaseConfig = (): FirebaseConfig => {
  const config: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Firebase Config Debug:', {
      apiKey: config.apiKey ? '✅ Set' : '❌ Missing',
      authDomain: config.authDomain ? '✅ Set' : '❌ Missing',
      projectId: config.projectId ? '✅ Set' : '❌ Missing',
      storageBucket: config.storageBucket ? '✅ Set' : '❌ Missing',
      messagingSenderId: config.messagingSenderId ? '✅ Set' : '❌ Missing',
      appId: config.appId ? '✅ Set' : '❌ Missing',
    });
  }

  validateFirebaseConfig(config);
  return config;
};

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;
let messaging: Messaging | null = null;
let firebaseConfig: FirebaseConfig | null = null;

const initializeFirebase = (): FirebaseApp => {
  try {
    // Create and validate configuration from environment variables
    firebaseConfig = createFirebaseConfig();
    
    // Check if Firebase app is already initialized
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log(`Firebase initialized for project: ${firebaseConfig.projectId}`);
    } else {
      app = getApps()[0];
    }
    
    return app;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to initialize Firebase:', errorMessage);
    throw error;
  }
};

// Initialize Firebase services
const initializeFirebaseServices = (): void => {
  if (!app) {
    app = initializeFirebase();
  }
  
  // Initialize Auth
  auth = getAuth(app);
  
  // Initialize Firestore
  firestore = getFirestore(app);
  
  // Initialize Functions
  functions = getFunctions(app);
  
  // Initialize Messaging (only in browser environment)
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app!);
      }
    }).catch((error) => {
      console.warn('Firebase Messaging not supported:', error);
    });
  }
};

// Lazy initialization - only initialize when services are accessed
const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    initializeFirebaseServices();
  }
  return app!;
};

const getFirebaseAuth = (): Auth => {
  if (!auth) {
    initializeFirebaseServices();
  }
  return auth!;
};

const getFirebaseFirestore = (): Firestore => {
  if (!firestore) {
    initializeFirebaseServices();
  }
  return firestore!;
};

const getFirebaseFunctions = (): Functions => {
  if (!functions) {
    initializeFirebaseServices();
  }
  return functions!;
};

const getFirebaseMessaging = (): Messaging | null => {
  if (!messaging && typeof window !== 'undefined') {
    initializeFirebaseServices();
  }
  return messaging;
};

// Export Firebase services with lazy initialization
export { 
  getFirebaseApp as app,
  getFirebaseAuth as auth,
  getFirebaseFirestore as firestore,
  getFirebaseFunctions as functions,
  getFirebaseMessaging as messaging
};

// Export configuration for testing
export { firebaseConfig };

// Export initialization function for testing
export { initializeFirebase };