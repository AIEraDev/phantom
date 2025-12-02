#!/bin/bash

# Development Testing Script
# Comprehensive testing for Phantom application

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "=========================================="
echo "   Phantom Development Testing Suite"
echo "=========================================="
echo -e "${NC}"

# Parse arguments
RUN_DOCKER_TESTS=false
RUN_UNIT_TESTS=true
RUN_INTEGRATION_TESTS=false
START_SERVERS=true
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            RUN_DOCKER_TESTS=true
            shift
            ;;
        --no-unit)
            RUN_UNIT_TESTS=false
            shift
            ;;
        --integration)
            RUN_INTEGRATION_TESTS=true
            shift
            ;;
        --no-servers)
            START_SERVERS=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: ./scripts/dev-test.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --docker          Run Docker-based tests"
            echo "  --no-unit         Skip unit tests"
            echo "  --integration     Run integration tests"
            echo "  --no-servers      Don't start dev servers"
            echo "  --verbose         Show detailed output"
            echo "  --help            Show this help"
            echo ""
            echo "Examples:"
            echo "  ./scripts/dev-test.sh                    # Run unit tests"
            echo "  ./scripts/dev-test.sh --docker           # Run Docker tests"
            echo "  ./scripts/dev-test.sh --integration      # Run integration tests"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Check Docker (optional)
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
        echo -e "${GREEN}✓${NC} Docker: $DOCKER_VERSION (running)"
    else
        echo -e "${YELLOW}⚠${NC} Docker installed but not running"
    fi
else
    echo -e "${YELLOW}⚠${NC} Docker not installed (optional)"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version | cut -d' ' -f3)
    echo -e "${GREEN}✓${NC} PostgreSQL: $PSQL_VERSION"
else
    echo -e "${YELLOW}⚠${NC} PostgreSQL CLI not found (optional)"
fi

# Check Redis
if command -v redis-cli &> /dev/null; then
    REDIS_VERSION=$(redis-cli --version | cut -d' ' -f2)
    echo -e "${GREEN}✓${NC} Redis: $REDIS_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Redis CLI not found (optional)"
fi

echo ""

# Check if dependencies are installed
echo -e "${BLUE}Checking dependencies...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
fi
echo -e "${GREEN}✓${NC} Backend dependencies installed"

if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
fi
echo -e "${GREEN}✓${NC} Frontend dependencies installed"

echo ""

# Start development servers if requested
if [ "$START_SERVERS" = true ]; then
    echo -e "${BLUE}Starting development servers...${NC}"
    
    # Check if servers are already running
    if lsof -ti:3001 &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} Backend already running on port 3001"
    else
        echo -e "${CYAN}Starting backend server...${NC}"
        cd backend && npm run dev > ../logs/backend.log 2>&1 &
        BACKEND_PID=$!
        cd ..
        sleep 3
        
        if ps -p $BACKEND_PID > /dev/null; then
            echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"
        else
            echo -e "${RED}✗${NC} Backend failed to start"
            cat logs/backend.log
            exit 1
        fi
    fi
    
    if lsof -ti:3000 &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} Frontend already running on port 3000"
    else
        echo -e "${CYAN}Starting frontend server...${NC}"
        cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
        FRONTEND_PID=$!
        cd ..
        sleep 3
        
        if ps -p $FRONTEND_PID > /dev/null; then
            echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
        else
            echo -e "${RED}✗${NC} Frontend failed to start"
            cat logs/frontend.log
            exit 1
        fi
    fi
    
    echo ""
    echo -e "${GREEN}Development servers running:${NC}"
    echo -e "  Backend:  ${CYAN}http://localhost:3001${NC}"
    echo -e "  Frontend: ${CYAN}http://localhost:3000${NC}"
    echo ""
fi

# Run tests
TESTS_PASSED=0
TESTS_FAILED=0

# Unit Tests
if [ "$RUN_UNIT_TESTS" = true ]; then
    echo -e "${BLUE}=========================================="
    echo "Running Unit Tests"
    echo -e "==========================================${NC}"
    echo ""
    
    cd backend
    
    # Security middleware tests
    echo -e "${CYAN}1. Security Middleware Tests${NC}"
    if npm test -- --run security.middleware.test.ts &> /dev/null; then
        echo -e "${GREEN}✓${NC} Security middleware tests passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Security middleware tests failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        if [ "$VERBOSE" = true ]; then
            npm test -- --run security.middleware.test.ts
        fi
    fi
    
    cd ..
    echo ""
fi

# Docker Tests
if [ "$RUN_DOCKER_TESTS" = true ]; then
    echo -e "${BLUE}=========================================="
    echo "Running Docker Tests"
    echo -e "==========================================${NC}"
    echo ""
    
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        cd backend
        
        echo -e "${CYAN}Running Docker security tests...${NC}"
        if npm run test:docker -- --filter docker.security.test.ts; then
            echo -e "${GREEN}✓${NC} Docker security tests passed"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗${NC} Docker security tests failed"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        
        cd ..
    else
        echo -e "${YELLOW}⚠${NC} Docker not available, skipping Docker tests"
    fi
    echo ""
fi

# Integration Tests
if [ "$RUN_INTEGRATION_TESTS" = true ]; then
    echo -e "${BLUE}=========================================="
    echo "Running Integration Tests"
    echo -e "==========================================${NC}"
    echo ""
    
    # Health check
    echo -e "${CYAN}1. Backend Health Check${NC}"
    if curl -s http://localhost:3001/health | grep -q "ok"; then
        echo -e "${GREEN}✓${NC} Backend health check passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Backend health check failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Frontend check
    echo -e "${CYAN}2. Frontend Availability${NC}"
    if curl -s http://localhost:3000 | grep -q "Phantom"; then
        echo -e "${GREEN}✓${NC} Frontend is accessible"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} Frontend is not accessible"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    echo ""
fi

# Summary
echo -e "${BLUE}=========================================="
echo "Test Summary"
echo -e "==========================================${NC}"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    EXIT_CODE=0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    EXIT_CODE=1
fi

echo ""
echo -e "${BLUE}=========================================="
echo "Development Environment"
echo -e "==========================================${NC}"
echo ""
echo -e "Backend:  ${CYAN}http://localhost:3001${NC}"
echo -e "Frontend: ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "Logs:"
echo -e "  Backend:  ${CYAN}logs/backend.log${NC}"
echo -e "  Frontend: ${CYAN}logs/frontend.log${NC}"
echo ""
echo -e "Commands:"
echo -e "  ${CYAN}npm run test:docker${NC}              # Run Docker tests"
echo -e "  ${CYAN}npm run audit:security${NC}           # Security audit"
echo -e "  ${CYAN}tail -f logs/backend.log${NC}         # Watch backend logs"
echo -e "  ${CYAN}tail -f logs/frontend.log${NC}        # Watch frontend logs"
echo ""

exit $EXIT_CODE
