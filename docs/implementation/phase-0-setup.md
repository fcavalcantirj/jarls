# Phase 0: Project Setup

## Overview

Initialize the project structure, tooling, and infrastructure required for development.

**Prerequisites:** None
**Estimated Effort:** 1-2 days

---

## Task 0.1: Initialize Project Structure

### Description

Set up monorepo structure with shared types between server and client.

### Work Items

- [ ] Initialize npm workspace
- [ ] Create `/packages/server`
- [ ] Create `/packages/client`
- [ ] Create `/packages/shared`
- [ ] Configure TypeScript for all packages
- [ ] Set up ESLint + Prettier
- [ ] Configure Jest for testing
- [ ] Set up Git hooks (husky + lint-staged)

### Directory Structure

```
jarls/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── client/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── docs/
├── tests/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.base.json
└── jest.config.js
```

### Definition of Done

- [ ] `npm install` works from root
- [ ] `npm run build` compiles all packages without errors
- [ ] `npm test` runs (with placeholder test passing)
- [ ] `npm run lint` passes
- [ ] TypeScript strict mode enabled in all packages
- [ ] Shared types importable from server and client: `import { GameState } from '@jarls/shared'`

### Test Verification

```bash
# From project root
npm install
npm run build
npm test
npm run lint

# Verify shared imports work
cd packages/server
npx ts-node -e "import { GameState } from '@jarls/shared'; console.log('OK')"
```

---

## Task 0.2: Database Setup

### Description

Set up PostgreSQL schema and connection infrastructure.

### Work Items

- [ ] Create PostgreSQL database `jarls_dev`
- [ ] Create database schema (see below)
- [ ] Set up pg connection pool
- [ ] Create migration system (node-pg-migrate or similar)
- [ ] Set up Redis connection
- [ ] Create health check endpoint

### Database Schema

```sql
-- Game snapshots for fast restore
CREATE TABLE game_snapshots (
    game_id UUID PRIMARY KEY,
    state_snapshot JSONB NOT NULL,
    version INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'lobby',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Event log for replay/debugging
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES game_snapshots(game_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    player_id VARCHAR(100),
    version INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(game_id, version)
);

-- Player sessions
CREATE TABLE player_sessions (
    session_token VARCHAR(64) PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES game_snapshots(game_id) ON DELETE CASCADE,
    player_id VARCHAR(100) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_game_events_game_id ON game_events(game_id);
CREATE INDEX idx_game_events_created_at ON game_events(created_at);
CREATE INDEX idx_player_sessions_game_id ON player_sessions(game_id);
CREATE INDEX idx_player_sessions_expires ON player_sessions(expires_at);
```

### Environment Variables

```env
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/jarls_dev
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000
```

### Definition of Done

- [ ] PostgreSQL database created and accessible
- [ ] All schema migrations run successfully
- [ ] Connection pool configured and tested
- [ ] Redis connection established
- [ ] Health check endpoint returns status
- [ ] Environment variables documented

### Test Verification

```bash
# Start server
npm run dev

# Check health
curl http://localhost:3000/health
# Expected: { "status": "ok", "db": "connected", "redis": "connected" }

# Verify migrations
npm run db:migrate:status
# Expected: All migrations applied
```

### Health Check Implementation

```typescript
// GET /health
{
  "status": "ok",
  "timestamp": "2026-01-25T12:00:00Z",
  "db": "connected",
  "redis": "connected",
  "version": "0.1.0"
}
```

---

## Task 0.3: Development Tooling

### Description

Set up development environment for efficient workflow.

### Work Items

- [ ] Configure nodemon for server hot-reload
- [ ] Configure Vite for client hot-reload
- [ ] Set up VS Code workspace settings
- [ ] Configure debug launch configurations
- [ ] Set up Docker Compose for local services

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: jarls
      POSTGRES_PASSWORD: jarls_dev
      POSTGRES_DB: jarls_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  postgres_data:
```

### Definition of Done

- [ ] `npm run dev` starts server with hot-reload
- [ ] `npm run dev:client` starts client with hot-reload
- [ ] `docker-compose up -d` starts all services
- [ ] VS Code debugging works
- [ ] All developers can set up in < 30 minutes

### Test Verification

```bash
# Start infrastructure
docker-compose up -d

# Start development
npm run dev

# Make a change to server code - should auto-reload
# Make a change to client code - should auto-reload
```

---

## Phase 0 Checklist

### Prerequisites

- [ ] Node.js 20+ installed
- [ ] Docker installed
- [ ] PostgreSQL client installed (psql)

### Completion Criteria

- [ ] Task 0.1 complete
- [ ] Task 0.2 complete
- [ ] Task 0.3 complete
- [ ] New developer can clone and run in < 30 minutes
- [ ] CI pipeline runs tests on PR

### Handoff to Phase 1

- Project structure ready
- Database accessible
- Development workflow smooth
- Ready to implement game logic

---

_Phase 0 Status: Not Started_
