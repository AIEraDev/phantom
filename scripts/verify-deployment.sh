#!/bin/bash

# Deployment verification script
# Usage: ./scripts/verify-deployment.sh [environment]

set -e

ENVIRONMENT=${1:-local}

echo "🔍 Verifying Phantom deployment for environment: $ENVIRONMENT"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Environment variables check
echo "📋 Checking environment variables..."

if [ -f .env ]; then
    check_pass ".env file exists"
    
    # Check required variables
    if grep -q "DATABASE_URL=" .env && [ -n "$(grep DATABASE_URL= .env | cut -d'=' -f2)" ]; then
        check_pass "DATABASE_URL is set"
    else
        check_fail "DATABASE_URL is not set"
    fi
    
    if grep -q "REDIS_URL=" .env && [ -n "$(grep REDIS_URL= .env | cut -d'=' -f2)" ]; then
        check_pass "REDIS_URL is set"
    else
        check_fail "REDIS_URL is not set"
    fi
    
    if grep -q "JWT_SECRET=" .env && [ -n "$(grep JWT_SECRET= .env | cut -d'=' -f2)" ]; then
        check_pass "JWT_SECRET is set"
    else
        check_fail "JWT_SECRET is not set"
    fi
    
    if grep -q "ANTHROPIC_API_KEY=" .env && [ -n "$(grep ANTHROPIC_API_KEY= .env | cut -d'=' -f2)" ]; then
        check_pass "ANTHROPIC_API_KEY is set"
    else
        check_warn "ANTHROPIC_API_KEY is not set (AI features will be limited)"
    fi
else
    check_fail ".env file not found"
fi

echo ""

# Docker check
echo "🐳 Checking Docker..."

if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    
    if docker info > /dev/null 2>&1; then
        check_pass "Docker daemon is running"
    else
        check_fail "Docker daemon is not running"
    fi
else
    check_fail "Docker is not installed"
fi

echo ""

# Node.js check
echo "📦 Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js is installed ($NODE_VERSION)"
    
    # Check if version is 20+
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -ge 20 ]; then
        check_pass "Node.js version is 20 or higher"
    else
        check_warn "Node.js version should be 20 or higher (current: $NODE_VERSION)"
    fi
else
    check_fail "Node.js is not installed"
fi

echo ""

# Dependencies check
echo "📚 Checking dependencies..."

if [ -d "node_modules" ]; then
    check_pass "Root dependencies installed"
else
    check_warn "Root dependencies not installed (run: npm install)"
fi

if [ -d "backend/node_modules" ]; then
    check_pass "Backend dependencies installed"
else
    check_warn "Backend dependencies not installed (run: cd backend && npm install)"
fi

if [ -d "frontend/node_modules" ]; then
    check_pass "Frontend dependencies installed"
else
    check_warn "Frontend dependencies not installed (run: cd frontend && npm install)"
fi

echo ""

# Build check
echo "🔨 Checking builds..."

if [ -d "backend/dist" ]; then
    check_pass "Backend is built"
else
    check_warn "Backend not built (run: npm run build:backend)"
fi

if [ -d "frontend/.next" ]; then
    check_pass "Frontend is built"
else
    check_warn "Frontend not built (run: npm run build:frontend)"
fi

echo ""

# Service health checks (if running)
if [ "$ENVIRONMENT" = "local" ]; then
    echo "🏥 Checking service health..."
    
    # Check if services are running
    if docker-compose ps | grep -q "phantom-postgres.*Up"; then
        check_pass "PostgreSQL is running"
        
        # Test connection
        if docker-compose exec -T postgres pg_isready -U phantom > /dev/null 2>&1; then
            check_pass "PostgreSQL is accepting connections"
        else
            check_warn "PostgreSQL is not accepting connections"
        fi
    else
        check_warn "PostgreSQL is not running (run: docker-compose up -d postgres)"
    fi
    
    if docker-compose ps | grep -q "phantom-redis.*Up"; then
        check_pass "Redis is running"
        
        # Test connection
        if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            check_pass "Redis is accepting connections"
        else
            check_warn "Redis is not accepting connections"
        fi
    else
        check_warn "Redis is not running (run: docker-compose up -d redis)"
    fi
    
    # Check backend
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        check_pass "Backend is responding"
    else
        check_warn "Backend is not responding (run: npm run dev:backend)"
    fi
    
    # Check frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        check_pass "Frontend is responding"
    else
        check_warn "Frontend is not responding (run: npm run dev:frontend)"
    fi
fi

echo ""

# File structure check
echo "📁 Checking file structure..."

REQUIRED_FILES=(
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "docker-compose.yml"
    ".env.example"
    "DEPLOYMENT.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file exists"
    else
        check_fail "$file is missing"
    fi
done

echo ""

# Security check
echo "🔒 Checking security..."

if [ -f .env ]; then
    # Check if JWT_SECRET is the default
    if grep -q "JWT_SECRET=your_jwt_secret_here_change_in_production" .env; then
        check_fail "JWT_SECRET is using default value - CHANGE THIS!"
    else
        check_pass "JWT_SECRET is customized"
    fi
    
    # Check if DB_PASSWORD is the default
    if grep -q "DB_PASSWORD=phantom_dev_password" .env && [ "$ENVIRONMENT" = "production" ]; then
        check_fail "DB_PASSWORD is using default value - CHANGE THIS!"
    fi
fi

# Check if .env is in .gitignore
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    check_pass ".env is in .gitignore"
else
    check_fail ".env should be in .gitignore"
fi

echo ""
echo "✅ Verification complete!"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "📝 Production deployment checklist:"
    echo "  - Set strong JWT_SECRET"
    echo "  - Set strong DB_PASSWORD"
    echo "  - Configure ANTHROPIC_API_KEY"
    echo "  - Set NODE_ENV=production"
    echo "  - Enable HTTPS/TLS"
    echo "  - Configure CORS origins"
    echo "  - Set up database backups"
    echo "  - Configure monitoring"
    echo ""
fi
