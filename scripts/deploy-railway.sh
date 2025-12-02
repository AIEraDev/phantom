#!/bin/bash

# Deployment script for Railway (Backend only)
# Frontend is deployed separately (e.g., Vercel)
# Usage: ./scripts/deploy-railway.sh

set -e

echo "🚀 Deploying Phantom Backend to Railway..."

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
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY not set"
fi

# Deploy backend
echo "📦 Deploying backend..."
cd backend
railway up --service backend

echo "✅ Backend deployment complete!"
echo "🔗 Check your Railway dashboard for deployment status"
echo ""
echo "📝 Remember to set these environment variables in Railway:"
echo "   - DATABASE_URL (auto-provided by Railway PostgreSQL)"
echo "   - REDIS_URL (auto-provided by Railway Redis)"
echo "   - JWT_SECRET"
echo "   - GEMINI_API_KEY"
echo "   - FRONTEND_URL (your Vercel/frontend URL)"
