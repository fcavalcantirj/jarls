<div align="center">

![Jarls - Viking Hex Strategy](jarls-banner.png)

# Jarls

**A Viking hex strategy game built almost entirely by AI**

[![Built with Claude](https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet?style=for-the-badge)](https://claude.ai)
[![Tests](https://img.shields.io/badge/Tests-865%2B%20passing-brightgreen?style=for-the-badge)]()
[![TDD](https://img.shields.io/badge/TDD-First-orange?style=for-the-badge)]()

_"I'm helping!"_ - Claude, probably

</div>

---

## The Ralph Wiggum Development Loop

This project was built using what I affectionately call the **Ralph Wiggum Loop** - a form of unassisted AI development where Claude Code runs autonomously in a continuous loop:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Human: "Add feature X"                                │
│      │                                                  │
│      ▼                                                  │
│   ┌─────────────────────────────────────────────┐       │
│   │  Claude reads codebase                      │       │
│   │  Claude writes tests (TDD)                  │       │
│   │  Claude implements feature                  │       │
│   │  Claude runs tests                          │       │
│   │  Claude fixes issues                        │       │
│   │  Claude commits & pushes                    │       │
│   └─────────────────────────────────────────────┘       │
│      │                                                  │
│      ▼                                                  │
│   Human: "Nice. Now add feature Y"                      │
│      │                                                  │
│      └──────────── (repeat) ────────────────────────────┘
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The human's role? Describe features, review results, drink coffee. The AI handles the rest - reading existing code, understanding patterns, writing tests first, implementing features, debugging, and even writing commit messages.

**865+ tests. Zero copy-paste from Stack Overflow. Pure vibes.**

---

## What is Jarls?

A browser-based turn-based strategy game featuring push-combat mechanics on a hexagonal grid. Players compete as Viking Jarls to claim the central Throne or eliminate all opponents by pushing them off the board edge.

### Game Features

- **Hexagonal grid combat** with push mechanics
- **Multiple AI opponents** (Local heuristic + Groq LLM-powered)
- **Real-time multiplayer** via Socket.IO
- **Three difficulty levels** - Beginner, Intermediate, Hard
- **Starvation mechanics** to prevent stalemates
- **Move history tracking** for AI context awareness

---

## Quick Start

```bash
# Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm run db:migrate

# Start development servers (client + server)
pnpm run dev
```

The client runs at `http://localhost:5173` and the server at `http://localhost:3000`.

---

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9.x
- Docker and Docker Compose (for PostgreSQL and Redis)

---

## Project Structure

```
jarls/
├── packages/
│   ├── shared/     # Game logic, types, hex math (no runtime deps)
│   ├── server/     # Express API, Socket.IO, XState state machine
│   └── client/     # React frontend with Canvas rendering
├── docker-compose.yml       # Development services (postgres, redis)
├── docker-compose.prod.yml  # Production services (app, postgres, redis)
├── Dockerfile               # Multi-stage production build
└── .github/workflows/       # CI pipeline
```

---

## The AI Development Philosophy

### TDD First - Always

Every feature follows Red-Green-Refactor:

1. **RED**: Write failing tests that describe expected behavior
2. **GREEN**: Write minimum code to make tests pass
3. **REFACTOR**: Clean up while keeping tests green

The AI doesn't skip tests. Ever. Because without a failing test, you can't prove you fixed anything.

### Server is Authority - Client is Dumb

The client is a "dumb terminal" that only:

- Renders what the server says
- Sends user input to the server
- Animates state transitions

ALL game logic lives server-side. No exceptions.

### Small Files - Big Impact

No file exceeds ~800 lines. When a file grows too large, it gets split into modules. This keeps AI context manageable and humans sane.

---

## Technology Stack

| Layer    | Technologies                                          |
| -------- | ----------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Zustand, Socket.IO Client |
| Backend  | Node.js 20, Express 5, Socket.IO, XState v5           |
| Database | PostgreSQL 16, Redis 7                                |
| Shared   | TypeScript game logic (hex math, combat, movement)    |
| Testing  | Jest, Playwright, Supertest                           |
| DevOps   | Docker, GitHub Actions, pnpm workspaces               |
| AI       | Groq LLM (Llama 3.1/3.3), Local Heuristic AI          |

---

## Architecture

```
Browser (React + Canvas)
    │
    ├── REST API (/api/*)     → Express routes → GameManager
    │
    └── WebSocket (socket.io) → Socket handlers → GameManager
                                                      │
                                                      ├── XState actors (game state machines)
                                                      ├── PostgreSQL (game snapshots + events)
                                                      └── Redis (sessions + Socket.IO adapter)
```

The server is authoritative: clients send commands, the server validates and applies them using shared game logic. Game state is managed by XState v5 state machines with persistence to PostgreSQL for crash recovery.

---

## Game Rules Summary

- **Objective**: Move your Jarl to the central Throne hex, or be the last Jarl standing.
- **Pieces**: Each player has 1 Jarl (strength 2) and several Warriors (strength 1).
- **Movement**: Warriors move 1-2 hexes in a straight line. Jarls move 1 hex (or 2 with a "draft formation" of 2+ Warriors behind).
- **Combat**: Moving into an occupied hex initiates a push. Attack = base strength + momentum (if moved 2 hexes) + inline support. Defense = base strength + bracing.
- **Push Resolution**: If attack > defense, the defender is pushed. Chains of pieces push together. Pieces pushed off the board edge are eliminated.
- **Starvation**: After 10 rounds without an elimination, each player must sacrifice their furthest Warrior from the Throne.

---

## Available Scripts

| Script                 | Description                         |
| ---------------------- | ----------------------------------- |
| `pnpm run dev`         | Start client and server in dev mode |
| `pnpm run build`       | Build all packages                  |
| `pnpm run test`        | Run Jest unit tests                 |
| `pnpm run test:e2e`    | Run Playwright E2E tests            |
| `pnpm run typecheck`   | TypeScript type checking            |
| `pnpm run lint`        | Run ESLint                          |
| `pnpm run docker:up`   | Start Docker services               |
| `pnpm run docker:down` | Stop Docker services                |
| `pnpm run db:migrate`  | Run database migrations             |

---

## Environment Variables

| Variable       | Default                                         | Description                  |
| -------------- | ----------------------------------------------- | ---------------------------- |
| `DATABASE_URL` | `postgresql://jarls:jarls@localhost:5432/jarls` | PostgreSQL connection string |
| `REDIS_URL`    | `redis://localhost:6379`                        | Redis connection string      |
| `PORT`         | `3000`                                          | Server port                  |
| `GROQ_API_KEY` | -                                               | API key for Groq LLM AI      |

---

## Production Deployment

```bash
docker compose -f docker-compose.prod.yml up -d
```

This builds the app from the Dockerfile and starts it alongside PostgreSQL and Redis.

---

## Contributing

This project welcomes contributions! Whether you're a human or an AI, feel free to:

1. Fork the repo
2. Create a feature branch
3. Write tests first (TDD!)
4. Implement your feature
5. Submit a PR

---

## License

MIT

---

<div align="center">

**Built with the Ralph Wiggum Loop**

_Human provides direction. AI does the work. Tests prove it works._

Made with mass amounts of coffee and Claude Code

</div>
