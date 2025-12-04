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
