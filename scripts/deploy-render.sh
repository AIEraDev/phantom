#!/bin/bash

# Deployment script for Render
# Usage: ./scripts/deploy-render.sh

set -e

echo "🚀 Deploying Phantom to Render..."

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "⚠️  Render CLI not found. Deployment will use Git push method."
    echo "📝 Make sure you've connected your repository to Render dashboard"
fi

# Run database migrations
echo "🗄️  Running database migrations..."
if [ -n "$DATABASE_URL" ]; then
    cd backend
    npm run migrate
    cd ..
    echo "✅ Migrations complete"
else
    echo "⚠️  DATABASE_URL not set, skipping migrations"
fi

# Build and test
echo "🔨 Building project..."
npm run build

echo "✅ Build complete!"
echo "📝 Push to your main branch to trigger Render deployment"
echo "🔗 Monitor deployment at: https://dashboard.render.com"
