#!/bin/bash

echo "🚀 Starting Phantom development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start or restart Docker containers (postgres and redis)
echo "📦 Starting Docker containers (postgres, redis)..."
docker-compose up -d postgres redis

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 3

# Check if containers are healthy
until docker exec phantom-postgres pg_isready -U phantom > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

until docker exec phantom-redis redis-cli ping > /dev/null 2>&1; do
    echo "   Waiting for Redis..."
    sleep 2
done

echo "✅ Docker services are ready!"

# Check if database is migrated
echo "🔍 Checking database status..."
cd backend
if npm run db:verify 2>&1 | grep -q "not exist\|error"; then
    echo "📊 Running database migrations..."
    npm run migrate
    echo "🌱 Seeding database..."
    npm run seed
else
    echo "✅ Database is ready!"
fi
cd ..

echo ""
echo "✨ All services ready! Starting development servers..."
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:3000"
echo ""
