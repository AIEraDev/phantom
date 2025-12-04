# Phantom - Kiroween Hackathon 2025 Submission

## What is Phantom?

Phantom is a real-time multiplayer coding battle platform where developers compete head-to-head in algorithmic challenges. Think LeetCode meets competitive gaming - players race to solve coding problems while watching their opponent's progress in real-time.

## Key Features

### 🎮 Real-time 1v1 Code Battles

Two players compete simultaneously on the same coding challenge. See your opponent's test case progress live, creating intense competitive pressure.

### 🤖 AI Code Coach

Powered by Google Gemini, the AI coach provides contextual hints, analyzes your code quality, and offers personalized feedback without giving away solutions.

### ⚡ Power-ups System

Strategic power-ups add a gaming twist:

- **Time Freeze** - Pause your opponent's timer
- **Code Peek** - Glimpse your opponent's approach
- **Debug Shield** - Protection from distractions

### 👻 Ghost Race Mode

Race against recorded sessions from top players or AI-generated solutions. Perfect for practice and learning optimal approaches.

### 📊 Skill Tree & Progression

Track your growth across algorithm categories. Unlock new challenges as you master concepts like arrays, trees, dynamic programming, and more.

### 🏆 Global Leaderboard

ELO-based ranking system that matches you with similarly skilled opponents for fair, competitive matches.

---

## How Kiro Was Used

Kiro was instrumental in building Phantom's complex features through spec-driven development:

### 1. Structured Feature Development

Every major feature was developed using Kiro's spec workflow:

- `judge0-cloud-integration` - Cloud code execution for production scalability
- `power-ups-system` - Real-time power-up mechanics with WebSocket sync
- `ai-code-coach` - Gemini-powered hint system with rate limiting
- `phantom-code-battle` - Core battle mechanics and matchmaking
- `authenticated-redirect` - Secure authentication flow

### 2. Requirements → Design → Implementation

Each spec followed Kiro's structured approach:

- **Requirements**: EARS-compliant acceptance criteria
- **Design**: Architecture diagrams, data models, correctness properties
- **Tasks**: Incremental implementation checklist

### 3. Steering Rules

Project-wide coding standards and conventions maintained consistency across the codebase through Kiro's steering files.

### 4. Iterative Refinement

Kiro's review workflow helped catch edge cases early - particularly valuable for real-time features where race conditions are common.

---

## Technical Stack

| Layer          | Technologies                                                 |
| -------------- | ------------------------------------------------------------ |
| Frontend       | Next.js 14, React 18, TypeScript, TailwindCSS, Monaco Editor |
| Backend        | Node.js, Express, TypeScript, Socket.io                      |
| Database       | PostgreSQL, Redis                                            |
| AI             | Google Gemini API                                            |
| Code Execution | Judge0 Cloud (production), Docker (development)              |
| Deployment     | Railway, Vercel                                              |

---

## Challenges We Ran Into

### 🐳 Docker Code Execution → Judge0 Migration

During local development, we built a Docker-based code execution system for evaluating user submissions. It worked beautifully—sandboxed containers with resource limits, secure isolation, the works. Then came deployment reality.

**The Problem:** Railway doesn't support Docker-in-Docker (DinD), which our code execution engine required. We couldn't spin up containers to run untrusted user code on the platform.

**The Pivot:** We had to completely switch from our custom Docker solution to Judge0's cloud API. This meant:

- Rewriting the entire code execution pipeline
- Adapting to Judge0's API rate limits and response format
- Working with a limited free-tier API key
- Handling the latency differences between local Docker and cloud API calls

Kiro's spec-driven approach saved us here—the `judge0-cloud-integration` spec helped us systematically plan the migration without breaking existing battle functionality.

### 🚂 Railway Backend Deployment Struggles

Deploying the backend to Railway was far from smooth. We encountered multiple issues:

- **Environment variable configuration** - Getting PostgreSQL and Redis connection strings properly formatted
- **Build failures** - TypeScript compilation issues that only appeared in Railway's build environment
- **Health check timeouts** - The service kept failing health checks during cold starts
- **WebSocket connectivity** - Socket.io connections dropping due to proxy configuration

**Kiro to the Rescue:** When we hit walls, Kiro helped troubleshoot each issue systematically. It analyzed error logs, suggested configuration fixes, and helped us understand Railway's specific requirements. We ended up deploying the backend, PostgreSQL, and Redis through Railway's CLI after the dashboard kept timing out.

### 🔄 Real-Time State Synchronization

Keeping two players' editors in sync with sub-100ms latency while handling:

- Network disconnections mid-battle
- Race conditions in test case submissions
- State recovery when players reconnect

This required careful WebSocket architecture and Redis pub/sub for cross-instance communication.

### ⚡ API Rate Limits

Both Gemini (AI Coach) and Judge0 (code execution) have rate limits. During intense battles with rapid submissions, we had to implement:

- Request queuing and debouncing
- Caching for similar code patterns
- Graceful degradation when limits are hit

---

## Why This Fits "Best Overall Project"

Phantom demonstrates Kiro's capability to manage complex, interconnected systems:

### 1. Real-time Complexity

WebSocket-based multiplayer requires careful state management - Kiro's specs helped define clear boundaries and behaviors.

### 2. Multiple AI Integrations

Both Gemini (coaching) and Judge0 (execution) required well-defined interfaces - spec-driven development ensured clean integration.

### 3. Production-Ready

The project is deployed and functional, not just a prototype. Kiro helped maintain quality throughout rapid development.

### 4. Full-Stack Scope

From database migrations to real-time UI updates, every layer was developed with Kiro's assistance.

---

## Try It

| Resource  | Link                                |
| --------- | ----------------------------------- |
| Live Demo | https://kiroween-phantom.vercel.app |
| GitHub    | https://github.com/AIEraDev/phantom |

### Test Accounts

| Email            | Password         |
| ---------------- | ---------------- |
| player1@test.com | player1@test.com |
| player2@test.com | player2@test.com |

---

## Kiro Specs Used

```
.kiro/
├── specs/
│   ├── ai-code-coach/           # AI-powered hints and coaching
│   ├── authenticated-redirect/   # Auth flow handling
│   ├── judge0-cloud-integration/ # Cloud code execution
│   ├── phantom-code-battle/      # Core battle mechanics
│   └── power-ups-system/         # Strategic power-ups
├── steering/                     # Project guidelines
└── vibe-coding/                  # Development sessions
```

Each spec contains:

- `requirements.md` - EARS-compliant acceptance criteria
- `design.md` - Architecture, data models, correctness properties
- `tasks.md` - Implementation checklist with progress tracking

---

## What We Learned

- **Platform limitations matter early** - Research deployment constraints before building. Our Docker execution system was elegant but unusable in production.
- **CLI > Dashboard** - When Railway's dashboard kept timing out, the CLI was more reliable for deploying services.
- **Kiro as a debugging partner** - Beyond code generation, Kiro excels at systematic troubleshooting. It helped us work through Railway deployment issues step by step.
- **Always have a fallback** - Judge0's cloud API saved the project when our Docker approach hit a wall.
- **Real-time is hard** - WebSocket state management across reconnections requires careful planning upfront.
