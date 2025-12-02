#!/bin/bash

# Production database migration script
# Usage: ./scripts/migrate-prod.sh

set -e

echo "🗄️  Running production database migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# Backup database before migration
echo "💾 Creating database backup..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

# Extract connection details from DATABASE_URL
# Format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\(.*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\(.*\)/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\(.*\):.*/\1/p')

if command -v pg_dump &> /dev/null; then
    pg_dump $DATABASE_URL > $BACKUP_FILE
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "⚠️  pg_dump not found, skipping backup"
fi

# Run migrations
echo "🔄 Running migrations..."
cd backend
npm run migrate

echo "✅ Migrations complete!"
echo "📊 Verifying database..."
npm run db:verify

echo "✅ Database verification complete!"
