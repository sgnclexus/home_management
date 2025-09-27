#!/bin/bash

# Frontend Deployment Script for Vercel
# This script builds and deploys the Next.js frontend to Vercel

set -e

echo "🚀 Starting frontend deployment..."

# Check if required environment variables are set
if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ Error: VERCEL_TOKEN environment variable is not set"
    exit 1
fi

# Set deployment environment (default to production)
ENVIRONMENT=${1:-production}
echo "📦 Deploying to environment: $ENVIRONMENT"

# Navigate to client directory
cd apps/client

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm run test:ci

# Run linting
echo "🔍 Running linter..."
npm run lint

# Run type checking
echo "🔧 Running type check..."
npm run type-check

# Build the application
echo "🏗️ Building application..."
npm run build

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
if [ "$ENVIRONMENT" = "production" ]; then
    npx vercel --prod --token $VERCEL_TOKEN --yes
else
    npx vercel --token $VERCEL_TOKEN --yes
fi

echo "✅ Frontend deployment completed successfully!"

# Get deployment URL
DEPLOYMENT_URL=$(npx vercel ls --token $VERCEL_TOKEN | head -n 2 | tail -n 1 | awk '{print $2}')
echo "🌐 Deployment URL: https://$DEPLOYMENT_URL"

# Run post-deployment health check
echo "🏥 Running health check..."
sleep 10
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DEPLOYMENT_URL")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed with status: $HTTP_STATUS"
    exit 1
fi

echo "🎉 Frontend deployment completed successfully!"