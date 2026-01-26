# Jarls (Norse Wars) - Implementation Plan

## Project Overview

A turn-based push-combat strategy game for 2-6 players on a hexagonal grid. Players compete to claim the central Throne or be the last Jarl standing.

**Ruleset Version:** 0.4.1

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + Socket.IO + XState v5 |
| Database | PostgreSQL + Redis |
| Frontend | Web (TypeScript + honeycomb-grid) |
| Testing | Jest + Supertest + Playwright |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Web)                       │
│  - honeycomb-grid (hex rendering)                       │
│  - Socket.IO client                                     │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket + REST
┌────────────────────────┴────────────────────────────────┐
│                    GAME SERVER                          │
│  - Express (REST API)                                   │
│  - Socket.IO (real-time events)                         │
│  - XState v5 (game state machine per game)              │
│  - Custom hex math (cube coords)                        │
│  - Push resolver (back-to-front algorithm)              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    PERSISTENCE                          │
│  - PostgreSQL (game snapshots + event log)              │
│  - Redis (sessions, Socket.IO adapter for scaling)      │
└─────────────────────────────────────────────────────────┘
```

---

## Phase Index

| Phase | Name | Description | Status |
|-------|------|-------------|--------|
| [0](./phase-0-setup.md) | Project Setup | Initialize project, database, tooling | Not Started |
| [1](./phase-1-core-logic.md) | Core Game Logic | Hex math, combat, chains, win conditions | Not Started |
| [2](./phase-2-state-machine.md) | Game State Machine | XState, persistence, game manager | Not Started |
| [3](./phase-3-network.md) | Network Layer | REST API, Socket.IO, sessions | Not Started |
| [4](./phase-4-ai.md) | AI Opponent | Move generation, difficulty levels | Not Started |
| [5](./phase-5-frontend.md) | Frontend | Web client, rendering, UI | Not Started |
| [6](./phase-6-production.md) | Production | Polish, deployment, documentation | Not Started |

---

## Milestones

| Milestone | Phases | Deliverable |
|-----------|--------|-------------|
| **Playable Prototype** | 0, 1, 2 | Core logic works, test via code |
| **Networked Alpha** | 3 | Two players can play via API/WebSocket |
| **Visual Alpha** | 5.1-5.4 | Web client playable |
| **AI Alpha** | 4 | Single player vs AI |
| **Beta** | 5.5, 6.1-6.2 | Feature complete |
| **Launch** | 6.3-6.4 | Production ready |

---

## Testing Strategy

### Unit Tests
- **Coverage:** Hex math, combat resolution, state transitions
- **Framework:** Jest
- **Location:** `*.test.ts` next to source files

### Integration Tests
- **Coverage:** API endpoints, database operations, Socket.IO
- **Framework:** Jest + Supertest + Socket.IO Client
- **Location:** `/tests/integration/`

### E2E Tests
- **Coverage:** Complete game flows, UI interactions
- **Framework:** Playwright
- **Location:** `/tests/e2e/`

### Manual Testing
- **Coverage:** Visual polish, game feel, edge cases
- **Checklist:** See `/tests/manual/checklist.md`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hex math bugs | High | Extensive unit tests, visual debugging tools |
| Chain resolution edge cases | High | Fuzzing with random game states |
| Race conditions in multiplayer | Medium | Atomic state machine transitions |
| Performance under load | Medium | Early load testing, Redis caching |
| Disconnection handling | Medium | Socket.IO recovery, session persistence |

---

## Open Questions

- [ ] Should we support game replays? (Event sourcing enables this)
- [ ] Should we add ranked matchmaking? (Future phase)
- [ ] Mobile app or PWA only?
- [ ] Monetization strategy? (Cosmetics, premium?)

---

*Document Version: 1.0*
*Last Updated: 2026-01-25*
