#!/bin/bash

# Full Stack Deployment Script
# This script deploys both frontend and backend components

set -e

echo "🚀 Starting full stack deployment..."

# Parse command line arguments
ENVIRONMENT=${1:-production}
COMPONENT=${2:-all}

echo "📦 Environment: $ENVIRONMENT"
echo "🎯 Component: $COMPONENT"

# Validate environment
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "development" ]]; then
    echo "❌ Error: Invalid environment. Use 'production', 'staging', or 'development'"
    exit 1
fi

# Validate component
if [[ "$COMPONENT" != "all" && "$COMPONENT" != "frontend" && "$COMPONENT" != "backend" ]]; then
    echo "❌ Error: Invalid component. Use 'all', 'frontend', or 'backend'"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the project root directory"
    exit 1
fi

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    echo "📋 Loading environment variables from .env.$ENVIRONMENT"
    export $(cat .env.$ENVIRONMENT | xargs)
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if all required environment variables are set
REQUIRED_VARS=()

if [[ "$COMPONENT" == "all" || "$COMPONENT" == "frontend" ]]; then
    REQUIRED_VARS+=("VERCEL_TOKEN")
fi

if [[ "$COMPONENT" == "all" || "$COMPONENT" == "backend" ]]; then
    REQUIRED_VARS+=("FIREBASE_PROJECT_ID" "FIREBASE_CLIENT_EMAIL" "FIREBASE_PRIVATE_KEY")
fi

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Run root level tests
echo "🧪 Running root level tests..."
npm run test:ci

# Deploy backend first (if applicable)
if [[ "$COMPONENT" == "all" || "$COMPONENT" == "backend" ]]; then
    echo "🔧 Deploying backend..."
    ./scripts/deploy-backend.sh $ENVIRONMENT
    
    # Wait for backend to be ready
    echo "⏳ Waiting for backend to be ready..."
    sleep 30
fi

# Deploy frontend (if applicable)
if [[ "$COMPONENT" == "all" || "$COMPONENT" == "frontend" ]]; then
    echo "🎨 Deploying frontend..."
    ./scripts/deploy-frontend.sh $ENVIRONMENT
fi

# Post-deployment integration tests
if [ "$COMPONENT" == "all" ]; then
    echo "🧪 Running integration tests..."
    
    # Set the API URL for integration tests
    if [ "$ENVIRONMENT" = "production" ]; then
        export API_URL="https://us-central1-your-production-project-id.cloudfunctions.net/api"
        export FRONTEND_URL="https://your-production-domain.com"
    else
        export API_URL="https://us-central1-your-staging-project-id.cloudfunctions.net/api"
        export FRONTEND_URL="https://your-staging-domain.vercel.app"
    fi
    
    # Run integration tests
    npm run test:integration
    
    echo "🏥 Running end-to-end health checks..."
    
    # Test API health
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
    if [ "$API_STATUS" != "200" ]; then
        echo "❌ API health check failed with status: $API_STATUS"
        exit 1
    fi
    
    # Test frontend health
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
    if [ "$FRONTEND_STATUS" != "200" ]; then
        echo "❌ Frontend health check failed with status: $FRONTEND_STATUS"
        exit 1
    fi
    
    echo "✅ All health checks passed!"
fi

# Send deployment notification (if configured)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    echo "📢 Sending deployment notification..."
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Home Management App deployed to $ENVIRONMENT successfully!\"}" \
        $SLACK_WEBHOOK_URL
fi

echo "🎉 Deployment completed successfully!"
echo "📊 Deployment Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   Component: $COMPONENT"
echo "   Timestamp: $(date)"

if [ "$COMPONENT" == "all" ]; then
    echo "   Frontend URL: $FRONTEND_URL"
    echo "   API URL: $API_URL"
fi