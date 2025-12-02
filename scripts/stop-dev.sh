#!/bin/bash

echo "🛑 Stopping Phantom development environment..."

# Stop Docker containers but keep data
echo "📦 Stopping Docker containers..."
docker-compose stop postgres redis

echo "✅ Development environment stopped!"
echo "   Data is preserved. Run 'npm run dev' to start again."
