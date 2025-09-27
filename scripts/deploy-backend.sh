#!/bin/bash

# Backend Deployment Script for Firebase Functions
# This script builds and deploys the NestJS backend to Firebase Functions

set -e

echo "🚀 Starting backend deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI is not installed"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Error: Not logged in to Firebase"
    echo "Login with: firebase login"
    exit 1
fi

# Set deployment environment (default to production)
ENVIRONMENT=${1:-production}
echo "📦 Deploying to environment: $ENVIRONMENT"

# Set Firebase project based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    FIREBASE_PROJECT="your-production-project-id"
else
    FIREBASE_PROJECT="your-staging-project-id"
fi

echo "🎯 Using Firebase project: $FIREBASE_PROJECT"

# Use the specified project
firebase use $FIREBASE_PROJECT

# Navigate to server directory
cd apps/server

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run type checking
echo "🔧 Running type check..."
npm run build

# Deploy Firestore rules and indexes
echo "🔒 Deploying Firestore rules and indexes..."
cd ../..
firebase deploy --only firestore:rules,firestore:indexes --project $FIREBASE_PROJECT

# Deploy Storage rules
echo "🗄️ Deploying Storage rules..."
firebase deploy --only storage --project $FIREBASE_PROJECT

# Deploy Functions
echo "🔧 Deploying Functions..."
firebase deploy --only functions --project $FIREBASE_PROJECT

# Run post-deployment health check
echo "🏥 Running health check..."
sleep 15

# Get the function URL
FUNCTION_URL="https://us-central1-$FIREBASE_PROJECT.cloudfunctions.net/api"
echo "🌐 Function URL: $FUNCTION_URL"

# Health check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FUNCTION_URL/health")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed with status: $HTTP_STATUS"
    exit 1
fi

echo "🎉 Backend deployment completed successfully!"