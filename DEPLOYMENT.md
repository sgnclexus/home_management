# Deployment Guide

This document provides comprehensive instructions for deploying the Home Management application to production and staging environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Vercel CLI** (`npm install -g vercel`)
- **Git**

### Required Accounts

- **Firebase Project** (for backend hosting and database)
- **Vercel Account** (for frontend hosting)
- **Stripe Account** (for payment processing)
- **PayPal Developer Account** (optional, for PayPal payments)
- **Sentry Account** (optional, for error tracking)

## Environment Setup

### 1. Firebase Setup

```bash
# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# Select the following features:
# - Functions
# - Firestore
# - Storage
# - Hosting (optional)
```

### 2. Vercel Setup

```bash
# Login to Vercel
vercel login

# Link your project
vercel link
```

### 3. Environment Variables

Copy the example environment files and configure them:

```bash
# Copy environment templates
cp .env.production.example .env.production
cp .env.staging.example .env.staging

# Edit the files with your actual values
nano .env.production
nano .env.staging
```

#### Required Environment Variables

**Firebase Configuration:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`

**Payment Configuration:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID` (optional)
- `PAYPAL_CLIENT_SECRET` (optional)

**Security Configuration:**
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `CORS_ORIGINS`

**Deployment Configuration:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `FIREBASE_TOKEN`

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Firebase Emulators

```bash
npm run firebase:emulators
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:client
npm run dev:server
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:ci
```

## Staging Deployment

Staging deployments are automatically triggered when code is pushed to the `develop` branch or when a pull request is created.

### Manual Staging Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Or deploy components individually
./scripts/deploy-backend.sh staging
./scripts/deploy-frontend.sh staging
```

### Staging URLs

- **Frontend:** `https://your-staging-domain.vercel.app`
- **API:** `https://us-central1-your-staging-project-id.cloudfunctions.net/api`

## Production Deployment

Production deployments are automatically triggered when code is pushed to the `main` branch.

### Manual Production Deployment

```bash
# Full production deployment
npm run deploy:production

# Deploy components individually
./scripts/deploy-backend.sh production
./scripts/deploy-frontend.sh production
```

### Pre-deployment Checklist

- [ ] All tests pass
- [ ] Security scan passes
- [ ] Environment variables are configured
- [ ] Database migrations are ready
- [ ] Monitoring is configured
- [ ] Backup procedures are in place

### Production URLs

- **Frontend:** `https://your-production-domain.com`
- **API:** `https://us-central1-your-production-project-id.cloudfunctions.net/api`

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment.

### Workflows

1. **Test and Quality** (`.github/workflows/test-and-quality.yml`)
   - Runs on every push and pull request
   - Executes linting, type checking, and tests
   - Performs security scans

2. **Deploy to Staging** (`.github/workflows/deploy-staging.yml`)
   - Runs on pushes to `develop` branch
   - Deploys to staging environment
   - Runs staging tests

3. **Deploy to Production** (`.github/workflows/deploy-production.yml`)
   - Runs on pushes to `main` branch
   - Deploys to production environment
   - Includes rollback procedures

### GitHub Secrets

Configure the following secrets in your GitHub repository:

**Firebase Secrets:**
- `FIREBASE_PROJECT_ID_PROD`
- `FIREBASE_PROJECT_ID_STAGING`
- `FIREBASE_CLIENT_EMAIL_PROD`
- `FIREBASE_CLIENT_EMAIL_STAGING`
- `FIREBASE_PRIVATE_KEY_PROD`
- `FIREBASE_PRIVATE_KEY_STAGING`
- `FIREBASE_TOKEN`

**Vercel Secrets:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_PROJECT_ID_STAGING`

**Payment Secrets:**
- `STRIPE_SECRET_KEY_PROD`
- `STRIPE_SECRET_KEY_STAGING`
- `STRIPE_WEBHOOK_SECRET_PROD`
- `STRIPE_WEBHOOK_SECRET_STAGING`

**Security Secrets:**
- `JWT_SECRET_PROD`
- `JWT_SECRET_STAGING`
- `ENCRYPTION_KEY_PROD`
- `ENCRYPTION_KEY_STAGING`

**Monitoring Secrets:**
- `SENTRY_DSN_PROD`
- `SENTRY_DSN_STAGING`
- `SLACK_WEBHOOK_URL`

## Monitoring and Maintenance

### Health Checks

The application includes built-in health check endpoints:

- **API Health:** `GET /api/health`
- **Frontend Health:** `GET /`

### Monitoring Services

1. **Firebase Performance Monitoring**
   - Automatically tracks performance metrics
   - Monitors API response times
   - Tracks user engagement

2. **Sentry Error Tracking**
   - Captures and reports errors
   - Provides detailed error context
   - Sends alerts for critical issues

3. **Uptime Monitoring**
   - Configure external uptime monitoring
   - Set up alerts for downtime
   - Monitor response times

### Maintenance Tasks

The application includes scheduled maintenance functions:

1. **Daily Maintenance** (runs at 2 AM daily)
   - Cleans up expired sessions
   - Archives old audit logs
   - Updates reservation statuses

2. **Payment Reminders** (runs every Monday at 9 AM)
   - Sends payment reminder notifications
   - Updates overdue payment statuses

### Backup Procedures

1. **Firestore Backup**
   ```bash
   # Export Firestore data
   gcloud firestore export gs://your-backup-bucket/firestore-backup
   ```

2. **Environment Configuration Backup**
   - Store environment configurations securely
   - Maintain version control of configuration changes

## Troubleshooting

### Common Issues

#### 1. Firebase Functions Deployment Fails

```bash
# Check Firebase project configuration
firebase projects:list
firebase use your-project-id

# Check function logs
firebase functions:log

# Redeploy with verbose logging
firebase deploy --only functions --debug
```

#### 2. Vercel Deployment Fails

```bash
# Check Vercel project configuration
vercel ls

# Check build logs
vercel logs your-deployment-url

# Redeploy with verbose logging
vercel --debug
```

#### 3. Environment Variables Not Loading

```bash
# Verify environment file exists
ls -la .env.*

# Check environment variable syntax
cat .env.production

# Validate Firebase configuration
npm run check:env
```

#### 4. Database Connection Issues

```bash
# Test Firestore connection
firebase firestore:delete test-doc --yes

# Check Firestore rules
firebase firestore:rules:get

# Validate indexes
firebase firestore:indexes
```

### Rollback Procedures

#### 1. Frontend Rollback

```bash
# List previous deployments
vercel ls

# Promote previous deployment
vercel promote your-previous-deployment-url
```

#### 2. Backend Rollback

```bash
# List previous function versions
firebase functions:list

# Deploy previous version
firebase deploy --only functions:api --force
```

### Support Contacts

- **Technical Issues:** Create an issue in the GitHub repository
- **Deployment Issues:** Check GitHub Actions logs
- **Security Issues:** Contact the security team immediately

## Performance Optimization

### Frontend Optimization

1. **Bundle Analysis**
   ```bash
   cd apps/client
   npm run analyze
   ```

2. **Image Optimization**
   - Use Next.js Image component
   - Implement lazy loading
   - Optimize image formats

3. **Caching Strategy**
   - Configure CDN caching
   - Implement service worker caching
   - Use browser caching headers

### Backend Optimization

1. **Function Performance**
   - Monitor cold start times
   - Optimize memory allocation
   - Implement connection pooling

2. **Database Optimization**
   - Create appropriate indexes
   - Optimize query patterns
   - Implement data pagination

3. **Caching Strategy**
   - Implement Redis caching
   - Use Firestore caching
   - Cache API responses

## Security Considerations

### Security Checklist

- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured
- [ ] Input validation implemented
- [ ] Rate limiting enabled
- [ ] Authentication tokens secured
- [ ] Environment variables encrypted
- [ ] Security headers configured
- [ ] Dependency vulnerabilities scanned

### Security Monitoring

1. **Automated Security Scans**
   - Snyk vulnerability scanning
   - npm audit checks
   - OWASP dependency checks

2. **Runtime Security**
   - Monitor authentication failures
   - Track suspicious API usage
   - Alert on security violations

3. **Data Protection**
   - Encrypt sensitive data
   - Implement data retention policies
   - Regular security audits

---

For additional support or questions, please refer to the project documentation or create an issue in the GitHub repository.