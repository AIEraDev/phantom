# Phantom - Real-time Code Battle Platform

A competitive multiplayer coding platform where developers battle head-to-head in algorithmic challenges.

## Tech Stack

**Backend:** Node.js, Express, TypeScript, Socket.io, PostgreSQL, Redis, Docker  
**Frontend:** Next.js 14, React 18, TypeScript, TailwindCSS, Monaco Editor

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Docker Desktop (running)

### Start Development

```bash
pnpm install
pnpm setup          # Start Docker containers + run migrations
```

Then open two terminals:

```bash
# Terminal 1 - Backend
pnpm dev:backend
```

```bash
# Terminal 2 - Frontend
pnpm dev:frontend
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### Stop Development

Press `Ctrl+C` in each terminal, then:

```bash
pnpm stop           # Stop Docker containers
```

## Project Structure

```
phantom/
├── backend/          # Express.js API
│   ├── src/
│   └── nodemon.json
├── frontend/         # Next.js App
│   └── src/app/
├── scripts/          # Dev scripts
└── docker-compose.yml
```

## Environment Variables

Backend uses `.env` and frontend uses `.env.local` - both are auto-created from examples on first run.

Optional: Add your `GEMINI_API_KEY` to `backend/.env` for AI judging features. Get one free at https://aistudio.google.com/apikey

## Troubleshooting

**Port in use:**

```bash
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

**Reset database:**

```bash
docker-compose down -v
pnpm dev
```

**Check services:**

```bash
docker ps                           # Containers
curl http://localhost:3001/health   # Backend
curl http://localhost:3000          # Frontend
```

## License

MIT
