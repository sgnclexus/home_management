import * as Joi from 'joi';

export const configValidation = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  API_PORT: Joi.number().default(3001),
  
  // Firebase Configuration
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().required(),
  FIREBASE_PRIVATE_KEY: Joi.string().required(),
  FIREBASE_DATABASE_URL: Joi.string().uri().required(),
  
  // JWT Configuration
  JWT_SECRET: Joi.string().required(),
  
  // Payment Configuration
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  
  // Optional PayPal Configuration
  PAYPAL_CLIENT_ID: Joi.string().optional(),
  PAYPAL_CLIENT_SECRET: Joi.string().optional(),
  
  // Notification Configuration
  FCM_SERVER_KEY: Joi.string().optional(),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
});