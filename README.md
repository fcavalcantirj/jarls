# Jarls

A browser-based turn-based strategy game featuring push-combat mechanics on a hexagonal grid. Players compete as Viking Jarls to claim the central Throne or eliminate all opponents by pushing them off the board edge.

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

## Prerequisites

- Node.js >= 20.0.0
- pnpm 9.x
- Docker and Docker Compose (for PostgreSQL and Redis)

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

## Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd jarls
pnpm install
```

### 2. Start infrastructure

```bash
pnpm run docker:up
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379.

### 3. Run migrations

```bash
pnpm run db:migrate
```

### 4. Start dev servers

```bash
pnpm run dev
```

This runs the Vite client dev server (port 5173) and the Express server (port 3000) concurrently. The Vite dev server proxies `/api` and `/socket.io` requests to the Express server.

### 5. Run individually

```bash
pnpm run dev:client   # Client only (port 5173)
pnpm run dev:server   # Server only (port 3000)
```

## Environment Variables

| Variable       | Default                                         | Description                                       |
| -------------- | ----------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL` | `postgresql://jarls:jarls@localhost:5432/jarls` | PostgreSQL connection string                      |
| `REDIS_URL`    | `redis://localhost:6379`                        | Redis connection string                           |
| `PORT`         | `3000`                                          | Server port                                       |
| `NODE_ENV`     | `development`                                   | Environment (`development`, `production`, `test`) |

Copy `.env.example` to `.env` to override defaults:

```bash
cp .env.example .env
```

## Available Scripts

| Script                         | Description                          |
| ------------------------------ | ------------------------------------ |
| `pnpm run dev`                 | Start client and server in dev mode  |
| `pnpm run dev:client`          | Start Vite client dev server         |
| `pnpm run dev:server`          | Start Express server with hot-reload |
| `pnpm run build`               | Build all packages                   |
| `pnpm run test`                | Run Jest unit tests                  |
| `pnpm run test:e2e`            | Run Playwright E2E tests             |
| `pnpm run typecheck`           | TypeScript type checking             |
| `pnpm run lint`                | Run ESLint                           |
| `pnpm run format`              | Format code with Prettier            |
| `pnpm run format:check`        | Check formatting                     |
| `pnpm run docker:up`           | Start Docker services                |
| `pnpm run docker:down`         | Stop Docker services                 |
| `pnpm run db:migrate`          | Run database migrations              |
| `pnpm run db:rollback`         | Rollback last migration              |
| `pnpm run db:create-migration` | Create a new migration file          |

## Production Deployment

### Using Docker Compose

```bash
docker compose -f docker-compose.prod.yml up -d
```

This builds the app from the Dockerfile and starts it alongside PostgreSQL and Redis. The server serves the built client as static files.

### Environment

Set `POSTGRES_PASSWORD` in your environment or `.env` file for production. All services include health checks and `restart: unless-stopped` policies.

## Technology Stack

| Layer    | Technologies                                          |
| -------- | ----------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Zustand, Socket.IO Client |
| Backend  | Node.js 20, Express 5, Socket.IO, XState v5           |
| Database | PostgreSQL 16, Redis 7                                |
| Shared   | TypeScript game logic (hex math, combat, movement)    |
| Testing  | Jest, Playwright, Supertest                           |
| DevOps   | Docker, GitHub Actions, pnpm workspaces               |
| Quality  | ESLint, Prettier, Husky, TypeScript strict mode       |

## Architecture Overview

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

### Package Dependencies

```
@jarls/shared (no runtime deps)
    ↑               ↑
    │               │
@jarls/server   @jarls/client
```

- **@jarls/shared** — Pure TypeScript game logic with zero runtime dependencies. Contains hex coordinate math, board generation, combat calculations, move validation, starvation mechanics, and all type definitions. Both server and client import from this package.
- **@jarls/server** — Express 5 REST API + Socket.IO WebSocket server. Uses XState v5 for game state machines, PostgreSQL for persistence (snapshots + events), Redis for sessions and Socket.IO adapter. Depends on `@jarls/shared` for all game rule enforcement.
- **@jarls/client** — React 18 SPA with Canvas-based hex board rendering. Uses Zustand for client state, Socket.IO for real-time communication, and imports types + utility functions from `@jarls/shared`. All game logic runs server-side; the client only sends commands and renders state.

### Shared Package Modules

```
shared/src/
├── types.ts           # All type/interface definitions
├── hex.ts             # Hex coordinate math (distance, neighbors, lines)
├── board.ts           # Board generation, starting positions, shield placement
├── combat.ts          # Combat orchestration (re-exports combat-core.ts)
├── combat-core.ts     # Attack/defense calculation, push resolution
├── move.ts            # Move execution, valid moves (re-exports move-validation.ts)
├── move-validation.ts # Path validation, draft formation detection
├── starvation.ts      # Starvation trigger, candidate selection, resolution
└── index.ts           # Barrel re-export of all modules
```

## Game Rules Summary

- **Objective**: Move your Jarl to the central Throne hex, or be the last Jarl standing.
- **Pieces**: Each player has 1 Jarl (strength 2) and several Warriors (strength 1).
- **Movement**: Warriors move 1-2 hexes in a straight line. Jarls move 1 hex (or 2 with a "draft formation" of 2+ Warriors behind).
- **Combat**: Moving into an occupied hex initiates a push. Attack = base strength + momentum (if moved 2 hexes) + inline support. Defense = base strength + bracing.
- **Push Resolution**: If attack > defense, the defender is pushed. Chains of pieces push together. Pieces pushed off the board edge are eliminated.
- **Starvation**: After 10 rounds without an elimination, each player must sacrifice their furthest Warrior from the Throne.

## Monorepo Guidelines

- No source code file should exceed ~800 lines (split into modules if needed).
- Test files mirror source structure.
- All packages share a common TypeScript base config with strict mode.
