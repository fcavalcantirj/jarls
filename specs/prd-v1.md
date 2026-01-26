# Jarls - Product Requirements Document (PRD)

## 1. Executive Summary

**Jarls** is a browser-based turn-based strategy game featuring push-combat mechanics on a hexagonal grid. Players compete as Viking Jarls to either claim the central Throne or eliminate all opponents by pushing their pieces off the board edge.

### Vision
Create an engaging, accessible, and strategically deep multiplayer game that runs entirely in the browser with real-time online play and AI opponents.

### MVP Scope
- **Platform:** Web (modern browsers)
- **Players:** 2-player matches (architecture supports 2-6 for future)
- **Modes:** Human vs Human (online), Human vs AI
- **Target:** Fully playable end-to-end experience

---

## 2. Game Overview

### 2.1 Core Concept
A turn-based strategy game where victory comes from:
1. **Throne Victory:** Move your Jarl onto the central Throne hex
2. **Last Standing:** Eliminate all enemy Jarls by pushing them off the board

### 2.2 Key Mechanics
| Mechanic | Description |
|----------|-------------|
| **Push Combat** | Pieces push enemies based on Attack vs Defense calculation |
| **Formations** | Inline support adds attack power; bracing adds defense |
| **Momentum** | Moving 2 hexes before attacking grants +1 attack |
| **Chain Pushing** | Pushed pieces push whatever is behind them |
| **Edge Elimination** | Pieces pushed off the board are permanently removed |
| **Compression** | Shields and Throne stop chains without eliminating |

### 2.3 Pieces

| Piece | Strength | Movement | Special |
|-------|----------|----------|---------|
| **Jarl** | 2 | 1 hex (2 with draft) | Only piece that can enter Throne |
| **Warrior** | 1 | 1-2 hexes straight | Provides draft/support for Jarl |
| **Shield** | ∞ | Immovable | Neutral obstacle, causes compression |

### 2.4 Board Setup (2-Player MVP)
- Board radius: 3 (37 hexes)
- Shields: 5 (symmetrically placed)
- Warriors per player: 5
- Jarls start at opposite edges, equidistant from Throne

---

## 3. Functional Requirements

### 3.1 Game Flow

#### FR-001: Game Creation
- User can create a new game
- Options: vs Human or vs AI
- AI difficulty levels: Easy, Medium, Hard
- Turn timer: None, 30s, 60s, 120s

#### FR-002: Game Joining
- Users can view list of joinable games
- Users can join games in "lobby" status
- Users receive unique session token on join

#### FR-003: Game Lobby
- Shows connected players
- Host can start game when 2 players present
- Players can leave lobby

#### FR-004: Turn System
- Rotating turn order
- One piece moved per turn
- Turn timer with auto-skip on expiration
- Cannot voluntarily pass if legal moves exist

#### FR-005: Movement
- Warriors: 1-2 hexes in straight line
- Jarl: 1 hex (or 2 with draft formation)
- Cannot move through pieces
- Cannot land on friendly pieces

#### FR-006: Combat Resolution
- Attack = Base Strength + Momentum + Inline Support
- Defense = Base Strength + Bracing
- Push if Attack > Defense
- Blocked if Attack ≤ Defense (attacker stops adjacent)

#### FR-007: Chain Resolution
- All pieces in chain move in push direction
- Edge pushes eliminate pieces
- Shield/Throne compression stops chain without elimination
- **Critical:** Jarls cannot be pushed onto Throne

#### FR-008: Win Conditions
- **Throne Victory:** Jarl voluntarily moves onto Throne (immediate win)
- **Last Standing:** Only one Jarl remains
- Throne takes precedence over Last Standing

#### FR-009: Starvation Mechanic
- Triggers after 10 rounds with no elimination
- Each player loses 1 Warrior (furthest from Throne)
- Tie-breaker: Player chooses which Warrior
- Repeats every 5 rounds until resolution
- Jarl eliminated if no Warriors remain after grace period

#### FR-010: Disconnection Handling
- 2-minute reconnection window
- AI takes over after window expires
- Player can resume control on reconnection

#### FR-011: Spectator Mode
- Unlimited spectators per game
- Real-time state updates
- No gameplay interaction

### 3.2 AI Opponent

#### FR-012: AI Difficulty Levels
| Level | Behavior |
|-------|----------|
| Easy | Random valid moves |
| Medium | Heuristic-based (prioritizes winning moves, avoids edge) |
| Hard | Minimax with evaluation (optional for MVP) |

#### FR-013: AI Behavior
- 500-1500ms thinking delay for UX
- 2-second timeout maximum
- Takes over disconnected players

### 3.3 User Interface

#### FR-014: Game Board
- Hexagonal grid rendered on canvas
- Clear piece distinction (Jarl vs Warrior, player colors)
- Throne highlighted at center
- Shields visually distinct

#### FR-015: Move Interaction
- Click/tap to select own piece
- Valid moves highlighted (green for move, red for attack)
- Momentum indicator on 2-hex moves
- Combat preview on hover over attack destination
- Click destination to execute move

#### FR-016: Game State Display
- Current player indicator
- Turn timer (if enabled)
- Player list with piece counts
- Your-turn notification

#### FR-017: Animations
- Smooth piece movement (200ms)
- Staggered chain push animation (80ms delay per link)
- Dramatic elimination animation (fly off board)
- 60fps target

#### FR-018: Game End
- Victory/Defeat modal
- Win condition displayed
- Play Again / Leave options

#### FR-019: Responsive Design
- Desktop and mobile support
- Touch input on mobile devices
- Adapts to viewport size

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  - Canvas rendering (honeycomb-grid)                    │
│  - Socket.IO client                                     │
│  - State management                                     │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket + REST
┌────────────────────────┴────────────────────────────────┐
│                     GAME SERVER                         │
│  - Express (REST API)                                   │
│  - Socket.IO (real-time events)                         │
│  - XState v5 (game state machine)                       │
│  - Game logic (shared package)                          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    PERSISTENCE                          │
│  - PostgreSQL (game snapshots + events)                 │
│  - Redis (sessions, Socket.IO adapter)                  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | TypeScript, Vite, Canvas, honeycomb-grid, Socket.IO Client |
| **Backend** | Node.js, Express, Socket.IO, XState v5 |
| **Database** | PostgreSQL 16, Redis 7 |
| **Shared** | TypeScript types/interfaces, game logic |
| **Testing** | Jest, Supertest, Playwright |
| **DevOps** | Docker, Docker Compose, GitHub Actions |

### 4.3 Monorepo Structure

```
jarls/
├── packages/
│   ├── shared/          # Types, game logic, hex math
│   ├── server/          # API, WebSocket, state machine
│   └── client/          # Web frontend
├── docs/                # Documentation
├── specs/               # Game specifications
├── tests/
│   ├── integration/
│   └── e2e/
└── docker-compose.yml
```

### 4.4 Database Schema

```sql
-- Game state snapshots
game_snapshots (
  game_id UUID PRIMARY KEY,
  state_snapshot JSONB,
  version INT,
  status VARCHAR(20),
  created_at, updated_at
)

-- Event log for replay/audit
game_events (
  id UUID PRIMARY KEY,
  game_id UUID FK,
  event_type VARCHAR(100),
  payload JSONB,
  player_id VARCHAR(100),
  version INT,
  created_at
)

-- Player sessions
player_sessions (
  session_token VARCHAR(64) PRIMARY KEY,
  game_id UUID FK,
  player_id VARCHAR(100),
  player_name VARCHAR(100),
  created_at, expires_at
)
```

---

## 5. API Specification

### 5.1 REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/games` | Create new game |
| GET | `/api/games` | List joinable games |
| GET | `/api/games/:id` | Get game state |
| POST | `/api/games/:id/join` | Join game |
| POST | `/api/games/:id/start` | Start game (host only) |
| GET | `/api/games/:id/valid-moves/:pieceId` | Get valid moves for piece |
| GET | `/health` | Health check |

### 5.2 WebSocket Events

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `joinGame` | `{ gameId, token }` | Connect to game room |
| `playTurn` | `{ command: MoveCommand }` | Execute move |
| `startGame` | `{}` | Start game (host) |
| `getValidMoves` | `{ pieceId }` | Request valid moves |
| `starvationChoice` | `{ pieceId }` | Select warrior for starvation |
| `spectate` | `{ gameId }` | Join as spectator |

**Server → Client:**
| Event | Payload | Description |
|-------|---------|-------------|
| `gameState` | `GameState` | Full state update |
| `turnPlayed` | `{ events, newState }` | Move result with animations |
| `gameEnded` | `{ winner, condition }` | Game over |
| `playerJoined` | `{ player }` | New player joined |
| `playerLeft` | `{ playerId }` | Player disconnected |
| `starvationRequired` | `{ choices }` | Starvation selection needed |

---

## 6. Implementation Phases

### Phase 0: Project Setup
- Initialize monorepo structure
- Configure TypeScript, ESLint, Prettier
- Set up PostgreSQL + Redis (Docker)
- Create health check endpoint
- **Deliverable:** Development environment ready

### Phase 1: Core Game Logic
- Hex coordinate system (cube coordinates)
- Game state types and interfaces
- Board generation with scaling
- Move validation
- Combat resolution (Attack vs Defense)
- Push chain resolution
- Win condition detection
- Starvation mechanic
- **Deliverable:** Complete game logic with tests

### Phase 2: Game State Machine
- XState v5 state machine
- States: lobby → setup → playing → ended
- Turn timer integration
- Game persistence (PostgreSQL)
- Game manager service
- **Deliverable:** Server-side game orchestration

### Phase 3: Network Layer
- REST API endpoints
- Socket.IO integration
- Session management
- Reconnection handling
- **Deliverable:** Playable via API/WebSocket

### Phase 4: AI Opponent
- RandomAI (easy)
- HeuristicAI (medium)
- AI integration with game manager
- Disconnection takeover
- **Deliverable:** Single-player vs AI mode

### Phase 5: Frontend
- Hex grid rendering (Canvas)
- Input handling (click/touch)
- Move animations
- Game UI components
- Lobby UI
- **Deliverable:** Complete web client

### Phase 6: Polish & Production
- Error handling
- Performance optimization
- Docker deployment
- CI/CD pipeline
- Documentation
- **Deliverable:** Production-ready application

---

## 7. Non-Functional Requirements

### 7.1 Performance
| Metric | Target |
|--------|--------|
| Valid moves calculation | < 10ms |
| API response time | < 100ms |
| WebSocket latency | < 50ms |
| Animation frame rate | 60fps |
| AI move generation | < 2s |

### 7.2 Scalability
- Stateless server design (horizontal scaling)
- Redis for session/Socket.IO adapter
- Event sourcing for game replay

### 7.3 Reliability
- Reconnection window: 2 minutes
- Session expiration: 24 hours
- Game state persistence
- Optimistic locking for concurrent updates

### 7.4 Security
- Secure session tokens
- Move validation on server
- Input sanitization (Zod)
- No client-trust for game state

### 7.5 Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

---

## 8. Testing Strategy

| Type | Framework | Coverage |
|------|-----------|----------|
| Unit | Jest | Hex math, combat, state transitions |
| Integration | Jest + Supertest | API endpoints, database, Socket.IO |
| E2E | Playwright | Complete game flows, UI interactions |
| Visual | Jest snapshot | Board rendering |

### Critical Test Scenarios
1. Complete 2-player game (throne victory)
2. Complete 2-player game (last standing)
3. Push chain with multi-elimination
4. Throne compression (Jarl cannot be pushed onto Throne)
5. Starvation trigger and resolution
6. Disconnection and AI takeover
7. Turn timeout auto-skip

---

## 9. Success Criteria

### MVP Launch Criteria
- [ ] 2-player online game works end-to-end
- [ ] AI opponent plays valid moves at all difficulties
- [ ] Both win conditions function correctly
- [ ] Push chains resolve correctly in all scenarios
- [ ] Starvation mechanic works
- [ ] Disconnection handling with AI takeover
- [ ] Responsive on desktop and mobile
- [ ] < 5 critical bugs in testing

### Metrics to Track
- Games completed per day
- Average game duration
- Win rate by condition (throne vs elimination)
- Disconnection rate
- AI win rate by difficulty

---

## 10. Future Enhancements (Post-MVP)

| Feature | Description |
|---------|-------------|
| 3-6 player support | Enable full player count range |
| Ranked matchmaking | ELO-based competitive play |
| Game replays | Watch completed games |
| Fog of War mode | Optional visibility rules |
| Draft Shields | Strategic shield placement phase |
| Team Mode | 2v2 and 3v3 variants |
| Mobile app | Native iOS/Android (PWA or React Native) |
| Cosmetics | Custom piece skins, board themes |

---

## 11. Appendix

### A. Combat Formula Reference

```
Attack = Base Strength + Momentum + Inline Support
Defense = Base Strength + Bracing

Where:
- Base Strength: Warrior = 1, Jarl = 2
- Momentum: +1 if moved 2 hexes to reach target
- Inline Support: Sum of friendly piece strengths directly behind attacker
- Bracing: Sum of friendly piece strengths directly behind defender

Result:
- Attack > Defense → PUSH (chain resolves)
- Attack ≤ Defense → BLOCKED (attacker stops adjacent)
```

### B. Board Scaling Table

| Players | Board Radius | Total Hexes | Shields | Warriors/Player |
|---------|--------------|-------------|---------|-----------------|
| 2 | 3 | 37 | 5 | 5 |
| 3 | 5 | 91 | 4 | 5 |
| 4 | 6 | 127 | 4 | 4 |
| 5 | 7 | 169 | 3 | 4 |
| 6 | 8 | 217 | 3 | 4 |

### C. Key Documents Reference
- [Game Rules v1](game-rules-v1.md) - Authoritative rule clarifications
- [Implementation Tasks](jarls.md) - Detailed task breakdown
- [Technical Docs](../docs/implementation/) - Phase-by-phase implementation guides

---

*Document Version: 1.0*
*Created: 2026-01-25*
*Based on: jarls-ruleset-v04.md (v0.4.1), game-rules-v1.md, implementation docs*
