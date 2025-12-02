# Authentication System

This directory contains the authentication implementation for the Phantom Code Battle platform.

## Overview

The authentication system provides secure user registration, login, and JWT-based session management.

## Components

### 1. JWT Utilities (`utils/jwt.ts`)

- Token generation with 24-hour expiration
- Token verification and payload extraction
- Uses HS256 algorithm with configurable secret

### 2. Authentication Service (`services/auth.service.ts`)

- **Registration**: Creates new users with validated credentials

  - Email format validation
  - Password strength validation (min 8 characters)
  - Username validation (3-20 characters, alphanumeric + hyphens/underscores)
  - Duplicate email/username detection
  - Password hashing with bcrypt (10 rounds)
  - Initial rating of 1000 for new users

- **Login**: Authenticates existing users
  - Credential verification
  - Password comparison using bcrypt
  - JWT token generation on success

### 3. Authentication Middleware (`middleware/auth.middleware.ts`)

- Validates JWT tokens from Authorization header
- Expects format: `Bearer <token>`
- Attaches user payload to `req.user` for downstream handlers
- Handles token expiration and invalid token errors
- Returns appropriate HTTP status codes (401 for auth failures)

### 4. Authentication Routes (`routes/auth.routes.ts`)

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected route example)

## Usage

### Registration

```typescript
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "username": "cooluser"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "cooluser",
    "rating": 1000,
    ...
  }
}
```

### Login

```typescript
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "cooluser",
    ...
  }
}
```

### Protected Routes

```typescript
GET /api/auth/me
Authorization: Bearer <token>

Response:
{
  "user": {
    "userId": "uuid",
    "email": "user@example.com",
    "username": "cooluser"
  }
}
```

## Testing

All components have comprehensive unit tests:

- `services/__tests__/auth.service.test.ts` - 13 tests covering registration and login
- `middleware/__tests__/auth.middleware.test.ts` - 7 tests covering middleware behavior

Run tests:

```bash
npm test -- --run src/services/__tests__/auth.service.test.ts src/middleware/__tests__/auth.middleware.test.ts
```

## Security Features

1. **Password Hashing**: bcrypt with 10 salt rounds
2. **JWT Tokens**: 24-hour expiration, signed with secret key
3. **Input Validation**: Email format, password strength, username constraints
4. **Error Messages**: Generic messages to prevent user enumeration
5. **Token Verification**: Middleware validates all protected routes

## Environment Variables

```bash
JWT_SECRET=your-secret-key-here  # Required for production
```

## Requirements Satisfied

- ✅ Requirement 1.1: User registration with email and password
- ✅ Requirement 1.2: Unique username and default rating of 1000
- ✅ Requirement 1.3: JWT token authentication
- ✅ Requirement 1.6: Secure credential handling
