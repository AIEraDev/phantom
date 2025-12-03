# Phantom - Project Overview

## What is Phantom?

Phantom is a real-time competitive coding battle platform where developers face off head-to-head in algorithmic challenges. Think LeetCode meets multiplayer gaming.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Socket.io, PostgreSQL, Redis
- **Frontend:** Next.js 14, React 18, TypeScript, TailwindCSS, Monaco Editor
- **Infrastructure:** Docker, Railway (production)

## Architecture Principles

1. **Real-time First** - All battle interactions use WebSockets via Socket.io
2. **Type Safety** - Full TypeScript across frontend and backend
3. **Monorepo Structure** - pnpm workspaces for shared tooling
4. **AI-Powered Judging** - Gemini API for intelligent code evaluation

## Key Features

- Real-time 1v1 code battles
- Live opponent progress tracking
- AI code coach for hints and guidance
- Power-ups system for competitive advantage
- Phantom mode for stealth coding

## Development Guidelines

- Run `pnpm install` at root for all dependencies
- Use `pnpm dev:backend` and `pnpm dev:frontend` in separate terminals
- Docker must be running for PostgreSQL and Redis
- Environment variables are auto-created from `.env.example` files
