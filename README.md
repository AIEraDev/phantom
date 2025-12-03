# Phantom - Real-time Code Battle Platform

A competitive multiplayer coding platform where developers battle head-to-head in algorithmic challenges. Built for the Kiroween Hackathon 2025.

## 🎮 Quick Demo (For Judges)

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Docker Desktop (must be running)

### Setup & Run (< 2 minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Start Docker containers + seed database
pnpm setup

# 3. Start backend (Terminal 1)
pnpm dev:backend

# 4. Start frontend (Terminal 2)
pnpm dev:frontend
```

### Test Accounts

| Email            | Password         | Username |
| ---------------- | ---------------- | -------- |
| player1@test.com | player1@test.com | Player_1 |
| player2@test.com | player2@test.com | Player_2 |

### Try It Out

1. Open http://localhost:3000
2. Login with `player1@test.com` in one browser
3. Login with `player2@test.com` in another browser (or incognito)
4. Both players click "Find Match" to battle each other!

---

## 🚀 Features

- **Real-time 1v1 Code Battles** - Compete head-to-head with live opponent progress
- **AI Code Coach** - Get hints and guidance powered by Gemini AI
- **Power-ups System** - Use strategic power-ups for competitive advantage
- **Phantom Mode** - Stealth coding to hide your progress from opponents
- **Ghost Race** - Race against recordings of top players
- **Skill Tree** - Track and develop your coding abilities
- **Leaderboard** - Global rankings with ELO-based rating system

## 🛠 Tech Stack

| Layer          | Technologies                                                 |
| -------------- | ------------------------------------------------------------ |
| Frontend       | Next.js 14, React 18, TypeScript, TailwindCSS, Monaco Editor |
| Backend        | Node.js, Express, TypeScript, Socket.io                      |
| Database       | PostgreSQL, Redis                                            |
| AI             | Google Gemini API                                            |
| Infrastructure | Docker, Railway                                              |

## 📁 Project Structure

```
phantom/
├── .kiro/              # Kiro specs, steering docs, vibe coding
│   ├── specs/          # Feature specifications
│   ├── steering/       # Project guidelines
│   └── vibe-coding/    # Development session logs
├── backend/            # Express.js API + WebSocket server
│   └── src/
│       ├── db/         # Database migrations & seeds
│       ├── services/   # Business logic
│       ├── routes/     # REST API endpoints
│       └── websocket/  # Real-time handlers
├── frontend/           # Next.js application
│   └── src/app/        # App router pages
├── scripts/            # Development utilities
└── docker-compose.yml  # Local PostgreSQL & Redis
```

## 🔧 Development

### Environment Variables

Backend (`backend/.env`) and frontend (`frontend/.env.local`) are auto-created from examples on first run.

**Optional:** Add `GEMINI_API_KEY` to `backend/.env` for AI features. Get one free at https://aistudio.google.com/apikey

### Code Execution Backends

Phantom supports two code execution backends for running user-submitted code:

| Backend              | Best For    | Requirements           | How It Works                                 |
| -------------------- | ----------- | ---------------------- | -------------------------------------------- |
| **Docker** (Default) | Development | Docker Desktop running | Runs code in isolated containers locally     |
| **Judge0**           | Production  | API key from RapidAPI  | Uses Judge0 Cloud API for scalable execution |

**Development (Docker):**

- Code runs in isolated Docker containers on your machine
- No external API keys needed
- Full control over execution environment
- Set `EXECUTION_BACKEND=docker` (default)

**Production (Judge0):**

- Code runs on Judge0 Cloud infrastructure
- No Docker needed in production
- Automatic scaling and security sandboxing
- Set `EXECUTION_BACKEND=judge0` and add `JUDGE0_API_KEY`
- Get free API key: https://rapidapi.com/judge0-official/api/judge0-ce

The system automatically falls back to Docker if Judge0 is unavailable or misconfigured

### Commands

```bash
pnpm install        # Install all dependencies
pnpm setup          # Start Docker + run migrations + seed
pnpm dev:backend    # Start backend server (port 3001)
pnpm dev:frontend   # Start frontend server (port 3000)
pnpm stop           # Stop Docker containers
```

### Troubleshooting

**Port in use:**

```bash
lsof -ti:3001 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

**Reset database:**

```bash
docker-compose down -v
pnpm setup
```

## 📜 License

MIT - See [LICENSE](LICENSE) file
