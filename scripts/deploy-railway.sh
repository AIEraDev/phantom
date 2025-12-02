#!/bin/bash

# Deployment script for Railway
# Usage: ./scripts/deploy-railway.sh

set -e

echo "🚀 Deploying Phantom to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it with: npm i -g @railway/cli"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

echo "✅ Railway CLI found and authenticated"

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not set"
fi

# Deploy backend
echo "📦 Deploying backend..."
cd backend
railway up --service backend

# Deploy frontend
echo "📦 Deploying frontend..."
cd ../frontend
railway up --service frontend

echo "✅ Deployment complete!"
echo "🔗 Check your Railway dashboard for deployment status"
