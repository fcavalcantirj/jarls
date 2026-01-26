# Jarls - Implementation Plan

## Overview

This document breaks down the implementation into small, actionable tasks. Each task should be completable in a focused session.

**Spec Reference:** [specs/game-rules-v1.md](./game-rules-v1.md)
**Detailed Docs:** [docs/implementation/](../docs/implementation/)

---

## Phase 0: Project Setup

### 0.1 Initialize Monorepo Structure

- [ ] **0.1.1** Create root `package.json` with npm workspaces configuration
  - *Source:* [phase-0-setup.md](../docs/implementation/phase-0-setup.md) Task 0.1
- [ ] **0.1.2** Create `packages/shared/` directory with `package.json` and `tsconfig.json`
- [ ] **0.1.3** Create `packages/server/` directory with `package.json` and `tsconfig.json`
- [ ] **0.1.4** Create `packages/client/` directory with `package.json` and `tsconfig.json`
- [ ] **0.1.5** Create root `tsconfig.base.json` with shared compiler options
- [ ] **0.1.6** Configure TypeScript project references between packages
- [ ] **0.1.7** Verify `npm install` works from root and installs all packages

### 0.2 Configure Tooling

- [ ] **0.2.1** Install and configure ESLint with TypeScript rules
- [ ] **0.2.2** Install and configure Prettier
- [ ] **0.2.3** Create `.eslintrc.js` and `.prettierrc` at root
- [ ] **0.2.4** Add `lint` and `format` scripts to root `package.json`
- [ ] **0.2.5** Install Husky and lint-staged for git hooks
- [ ] **0.2.6** Configure pre-commit hook to run lint-staged

### 0.3 Configure Testing

- [ ] **0.3.1** Install Jest and ts-jest in root
- [ ] **0.3.2** Create `jest.config.js` at root with project references
- [ ] **0.3.3** Create placeholder test in `packages/shared/src/__tests__/`
- [ ] **0.3.4** Verify `npm test` runs and passes

### 0.4 Database Setup

- [ ] **0.4.1** Create `docker-compose.yml` with PostgreSQL and Redis services
  - *Source:* [phase-0-setup.md](../docs/implementation/phase-0-setup.md) Task 0.2
- [ ] **0.4.2** Create `.env.example` with DATABASE_URL and REDIS_URL
- [ ] **0.4.3** Install `pg` and `@types/pg` in server package
- [ ] **0.4.4** Create database connection pool module (`packages/server/src/db/pool.ts`)
- [ ] **0.4.5** Install `node-pg-migrate` for migrations
- [ ] **0.4.6** Create migration: `game_snapshots` table
  - *Source:* [phase-0-setup.md](../docs/implementation/phase-0-setup.md) Database Schema
- [ ] **0.4.7** Create migration: `game_events` table
- [ ] **0.4.8** Create migration: `player_sessions` table
- [ ] **0.4.9** Create migration: indexes for all tables
- [ ] **0.4.10** Add `db:migrate` script to server package.json

### 0.5 Redis Setup

- [ ] **0.5.1** Install `ioredis` and `@types/ioredis` in server package
- [ ] **0.5.2** Create Redis connection module (`packages/server/src/redis/client.ts`)

### 0.6 Health Check Endpoint

- [ ] **0.6.1** Install Express and types in server package
- [ ] **0.6.2** Create basic Express app (`packages/server/src/app.ts`)
- [ ] **0.6.3** Implement `GET /health` endpoint that checks DB and Redis connections
- [ ] **0.6.4** Create `packages/server/src/index.ts` entry point
- [ ] **0.6.5** Add `dev` script with nodemon for hot-reload

### 0.7 Verify Setup

- [ ] **0.7.1** Run `docker-compose up -d` and verify services start
- [ ] **0.7.2** Run `npm run db:migrate` and verify tables created
- [ ] **0.7.3** Run `npm run dev` and verify health endpoint responds
- [ ] **0.7.4** Run `npm test` and verify all tests pass
- [ ] **0.7.5** Run `npm run lint` and verify no errors

---

## Phase 1: Core Game Logic

### 1.1 Hex Coordinate System

- [ ] **1.1.1** Define `CubeCoord` interface in `packages/shared/src/types/hex.ts`
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.1
- [ ] **1.1.2** Define `AxialCoord` interface
- [ ] **1.1.3** Define `HexDirection` type (0-5)
- [ ] **1.1.4** Define `DIRECTIONS` constant array with all 6 direction vectors
- [ ] **1.1.5** Implement `axialToCube()` function
- [ ] **1.1.6** Implement `cubeToAxial()` function
- [ ] **1.1.7** Write tests for coordinate conversion functions
- [ ] **1.1.8** Implement `hexDistance(a, b)` function
- [ ] **1.1.9** Write tests for `hexDistance`
- [ ] **1.1.10** Implement `getNeighbor(hex, direction)` function
- [ ] **1.1.11** Implement `getAllNeighbors(hex)` function
- [ ] **1.1.12** Write tests for neighbor functions
- [ ] **1.1.13** Implement `getOppositeDirection(direction)` function
- [ ] **1.1.14** Implement `hexLine(a, b)` with proper rounding
- [ ] **1.1.15** Write tests for `hexLine`
- [ ] **1.1.16** Implement `isOnBoard(hex, radius)` function
- [ ] **1.1.17** Implement `isOnEdge(hex, radius)` function
- [ ] **1.1.18** Write tests for board boundary functions
- [ ] **1.1.19** Implement `hexToKey(hex)` for Map storage
- [ ] **1.1.20** Implement `keyToHex(key)` for Map retrieval
- [ ] **1.1.21** Export all hex functions from shared package index

### 1.2 Game State Types

- [ ] **1.2.1** Define `PieceType` type (`'warrior' | 'jarl' | 'shield'`)
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.2
- [ ] **1.2.2** Define `Piece` interface
- [ ] **1.2.3** Define `Player` interface
- [ ] **1.2.4** Define `GameConfig` interface with scaling table values
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) (2-player MVP)
- [ ] **1.2.5** Define `GamePhase` type
- [ ] **1.2.6** Define `GameState` interface
- [ ] **1.2.7** Define `MoveCommand` interface
- [ ] **1.2.8** Define `CombatResult` interface with attack/defense breakdowns
- [ ] **1.2.9** Define `MoveResult` interface
- [ ] **1.2.10** Define `GameEvent` union type (MOVE, PUSH, ELIMINATED, etc.)
- [ ] **1.2.11** Define `StarvationChoice` interface
- [ ] **1.2.12** Define `ValidationResult` interface
- [ ] **1.2.13** Define `ValidMove` interface
- [ ] **1.2.14** Add JSDoc comments to all interfaces
- [ ] **1.2.15** Export all types from shared package index

### 1.3 Board Generation

- [ ] **1.3.1** Implement `getConfigForPlayerCount(count)` with scaling table
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.3
- [ ] **1.3.2** Implement `generateAllBoardHexes(radius)` function
- [ ] **1.3.3** Write tests for board hex generation
- [ ] **1.3.4** Implement `calculateStartingPositions(playerCount, radius)` for equidistant Jarls
- [ ] **1.3.5** Write tests verifying all Jarls are equidistant from center
- [ ] **1.3.6** Implement `generateSymmetricalShields(count, radius, playerCount)`
- [ ] **1.3.7** Implement `validateShieldPlacement(shields, startPositions)` - path check
- [ ] **1.3.8** Write tests for shield placement constraints
- [ ] **1.3.9** Implement `placeWarriors(jarlPosition, count, radius)` - place in front of Jarl
- [ ] **1.3.10** Write tests for warrior placement
- [ ] **1.3.11** Implement `createInitialState(config)` - full state creation
- [ ] **1.3.12** Write integration tests for 2-player board generation

### 1.4 Move Validation

- [ ] **1.4.1** Implement `getPieceAt(state, position)` helper
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.4
- [ ] **1.4.2** Implement `getPieceById(state, pieceId)` helper
- [ ] **1.4.3** Implement `isPathClear(state, from, to)` - checks no pieces block path
- [ ] **1.4.4** Write tests for path checking
- [ ] **1.4.5** Implement `hasDraftFormation(state, jarlPosition, direction)` - 2+ warriors behind
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Draft Formation
- [ ] **1.4.6** Write tests for draft detection (consecutive and non-consecutive)
- [ ] **1.4.7** Implement `validateMove(state, playerId, command)` - main validation function
- [ ] **1.4.8** Add check: piece exists
- [ ] **1.4.9** Add check: piece belongs to player
- [ ] **1.4.10** Add check: it's player's turn
- [ ] **1.4.11** Add check: game is in playing phase
- [ ] **1.4.12** Add check: destination is valid distance for piece type
- [ ] **1.4.13** Add check: path is clear
- [ ] **1.4.14** Add check: Jarl 2-hex move has draft formation
- [ ] **1.4.15** Add check: Warriors cannot enter Throne
- [ ] **1.4.16** Add check: cannot land on friendly piece
- [ ] **1.4.17** Write comprehensive tests for all validation rules

### 1.5 Combat Resolution

- [ ] **1.5.1** Implement `findInlineSupport(state, position, direction)` - find pieces behind
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.5
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Inline Support Stacking
- [ ] **1.5.2** Write tests for inline support detection (single and chain)
- [ ] **1.5.3** Implement `findBracing(state, position, pushDirection)` - find pieces behind defender
- [ ] **1.5.4** Write tests for bracing detection
- [ ] **1.5.5** Implement `calculateAttack(state, attackerPos, direction, hexesMoved)`
- [ ] **1.5.6** Write tests for attack calculation with all modifiers
- [ ] **1.5.7** Implement `calculateDefense(state, defenderPos, pushDirection)`
- [ ] **1.5.8** Write tests for defense calculation
- [ ] **1.5.9** Implement `calculateCombat(state, attackerPos, defenderPos, hexesMoved)` - returns CombatResult
- [ ] **1.5.10** Write tests for all combat examples from ruleset
  - Test: W → W (blocked)
  - Test: W →→ W (push with momentum)
  - Test: W W → W (push with support)
  - Test: W → W ← W (blocked by brace)
  - Test: J → W (push)
  - Test: J → J (blocked)
  - Test: W with Jarl behind (support = +2)

### 1.6 Push Chain Resolution

- [ ] **1.6.1** Implement `detectChain(state, startPos, direction)` - returns pieces in chain and terminator
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.6
- [ ] **1.6.2** Write tests for chain detection (empty, edge, shield, throne)
- [ ] **1.6.3** Implement `resolveSimplePush(state, chain)` - push into empty hex
- [ ] **1.6.4** Write tests for simple push
- [ ] **1.6.5** Implement `resolveEdgePush(state, chain)` - elimination at edge
- [ ] **1.6.6** Write tests for edge elimination (single and multi-piece)
- [ ] **1.6.7** Implement `resolveCompression(state, chain, blocker)` - shield/throne compression
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Throne Compression
- [ ] **1.6.8** Write tests for shield compression
- [ ] **1.6.9** Write tests for throne compression (Warriors)
- [ ] **1.6.10** Write tests for throne compression (Jarls cannot be pushed onto Throne)
- [ ] **1.6.11** Implement `resolvePush(state, attackerPos, direction)` - main resolver
- [ ] **1.6.12** Ensure events are generated with correct `depth` for staggered animation
- [ ] **1.6.13** Write integration tests for complex chain scenarios

### 1.7 Win Condition Detection

- [ ] **1.7.1** Implement `checkThroneVictory(state, pieceId, destination)` - voluntary entry only
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.7
- [ ] **1.7.2** Write tests: voluntary entry wins
- [ ] **1.7.3** Write tests: pushed onto throne does NOT win (should be blocked by compression)
- [ ] **1.7.4** Implement `eliminatePlayer(state, playerId)` - remove all their pieces
- [ ] **1.7.5** Write tests for player elimination
- [ ] **1.7.6** Implement `checkLastStanding(state)` - returns winner if only one Jarl remains
- [ ] **1.7.7** Write tests for last standing detection
- [ ] **1.7.8** Implement `checkWinConditions(state)` - checks both conditions
- [ ] **1.7.9** Write tests for win precedence (throne > last standing)

### 1.8 Starvation Mechanic

- [ ] **1.8.1** Implement `checkStarvationTrigger(state)` - 10 rounds without elimination
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.8
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Starvation Mechanic
- [ ] **1.8.2** Write tests for starvation trigger timing
- [ ] **1.8.3** Implement `calculateStarvationCandidates(state)` - furthest warriors from throne
- [ ] **1.8.4** Write tests for candidate selection (hex distance ignoring obstacles)
- [ ] **1.8.5** Implement tie-breaker: return multiple candidates for player choice
- [ ] **1.8.6** Write tests for tie-breaker scenarios
- [ ] **1.8.7** Implement `resolveStarvation(state, choices)` - apply starvation
- [ ] **1.8.8** Implement Jarl starvation when player has no warriors
- [ ] **1.8.9** Write tests for Jarl starvation
- [ ] **1.8.10** Implement starvation counter reset on any elimination
- [ ] **1.8.11** Write tests for counter reset

### 1.9 Valid Moves Calculator

- [ ] **1.9.1** Implement `getReachableHexes(state, piece)` - all hexes piece can reach
  - *Source:* [phase-1-core-logic.md](../docs/implementation/phase-1-core-logic.md) Task 1.9
- [ ] **1.9.2** Write tests for warrior movement range (1-2 hexes)
- [ ] **1.9.3** Write tests for jarl movement range (1 hex, 2 with draft)
- [ ] **1.9.4** Implement `getValidMoves(state, playerId, pieceId)` - returns ValidMove[]
- [ ] **1.9.5** Include move type (move vs attack)
- [ ] **1.9.6** Include hasMomentum flag
- [ ] **1.9.7** Include combat preview for attacks
- [ ] **1.9.8** Write tests for valid moves output
- [ ] **1.9.9** Write performance test (<10ms)

### 1.10 Apply Move

- [ ] **1.10.1** Implement `applyMove(state, playerId, command)` - main move executor
- [ ] **1.10.2** Handle simple move (no combat)
- [ ] **1.10.3** Handle attack with push
- [ ] **1.10.4** Handle attack blocked
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Blocked Attack Position
- [ ] **1.10.5** Generate all events for animation
- [ ] **1.10.6** Check win conditions after move
- [ ] **1.10.7** Return MoveResult with new state
- [ ] **1.10.8** Write integration tests for complete move scenarios

---

## Phase 2: Game State Machine

### 2.1 XState Machine Definition

- [ ] **2.1.1** Install XState v5 in server package
  - *Source:* [phase-2-state-machine.md](../docs/implementation/phase-2-state-machine.md) Task 2.1
- [ ] **2.1.2** Define machine input types
- [ ] **2.1.3** Define machine event types (PLAYER_JOINED, MAKE_MOVE, etc.)
- [ ] **2.1.4** Create machine with `lobby` state
- [ ] **2.1.5** Add `PLAYER_JOINED` and `PLAYER_LEFT` events in lobby
- [ ] **2.1.6** Add `START_GAME` transition with `hasEnoughPlayers` guard
- [ ] **2.1.7** Write tests for lobby state
- [ ] **2.1.8** Add `setup` state with board initialization
- [ ] **2.1.9** Add `playing` state with `awaitingMove` substate
- [ ] **2.1.10** Add `MAKE_MOVE` event with guards
- [ ] **2.1.11** Write tests for move handling
- [ ] **2.1.12** Add `turnEnding` substate with turn advancement
- [ ] **2.1.13** Add turn timer with `after` transition
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Turn Timeout (auto-skip)
- [ ] **2.1.14** Write tests for turn timeout
- [ ] **2.1.15** Add `starvation` state
- [ ] **2.1.16** Add `STARVATION_CHOICE` event
- [ ] **2.1.17** Write tests for starvation flow
- [ ] **2.1.18** Add `ended` final state
- [ ] **2.1.19** Write tests for game end transitions

### 2.2 Game Persistence

- [ ] **2.2.1** Create `GamePersistence` class
  - *Source:* [phase-2-state-machine.md](../docs/implementation/phase-2-state-machine.md) Task 2.2
- [ ] **2.2.2** Implement `save(gameId, actor, event?)` with optimistic locking
- [ ] **2.2.3** Write tests for save operation
- [ ] **2.2.4** Implement `restore(gameId)` - returns actor with restored state
- [ ] **2.2.5** Write tests for restore operation
- [ ] **2.2.6** Implement `replayFromEvents(gameId)` for debugging
- [ ] **2.2.7** Write tests verifying replay matches snapshot
- [ ] **2.2.8** Write tests for version conflict detection

### 2.3 Game Manager

- [ ] **2.3.1** Create `GameManager` class
  - *Source:* [phase-2-state-machine.md](../docs/implementation/phase-2-state-machine.md) Task 2.3
- [ ] **2.3.2** Implement `create(config)` - creates new game
- [ ] **2.3.3** Implement `join(gameId, playerName)` - adds player
- [ ] **2.3.4** Implement `start(gameId)` - starts game
- [ ] **2.3.5** Implement `makeMove(gameId, playerId, command)` - executes move
- [ ] **2.3.6** Implement `getState(gameId)` - returns current state
- [ ] **2.3.7** Implement `listGames(filter?)` - returns joinable games
- [ ] **2.3.8** Implement `recover()` - restore active games on server start
- [ ] **2.3.9** Write integration tests for game manager

---

## Phase 3: Network Layer

### 3.1 REST API Endpoints

- [ ] **3.1.1** Install Zod for validation
  - *Source:* [phase-3-network.md](../docs/implementation/phase-3-network.md) Task 3.1
- [ ] **3.1.2** Create validation schemas (CreateGameSchema, JoinGameSchema)
- [ ] **3.1.3** Implement error handling middleware
- [ ] **3.1.4** Implement `POST /api/games` - create game
- [ ] **3.1.5** Write tests for create game endpoint
- [ ] **3.1.6** Implement `GET /api/games` - list games
- [ ] **3.1.7** Write tests for list games endpoint
- [ ] **3.1.8** Implement `GET /api/games/:id` - get game state
- [ ] **3.1.9** Implement `POST /api/games/:id/join` - join game
- [ ] **3.1.10** Write tests for join game endpoint
- [ ] **3.1.11** Implement `POST /api/games/:id/start` - start game
- [ ] **3.1.12** Implement `GET /api/games/:id/valid-moves/:pieceId` - get valid moves
- [ ] **3.1.13** Write tests for valid moves endpoint

### 3.2 Socket.IO Integration

- [ ] **3.2.1** Install Socket.IO and types
  - *Source:* [phase-3-network.md](../docs/implementation/phase-3-network.md) Task 3.2
- [ ] **3.2.2** Define ServerToClientEvents interface
- [ ] **3.2.3** Define ClientToServerEvents interface
- [ ] **3.2.4** Set up Socket.IO server with CORS
- [ ] **3.2.5** Configure Connection State Recovery (2 min window)
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Disconnection Handling
- [ ] **3.2.6** Implement `joinGame` event handler
- [ ] **3.2.7** Implement `playTurn` event handler with acknowledgement
- [ ] **3.2.8** Implement `startGame` event handler
- [ ] **3.2.9** Implement broadcast for `turnPlayed`
- [ ] **3.2.10** Implement broadcast for `gameEnded`
- [ ] **3.2.11** Implement `spectate` event handler
- [ ] **3.2.12** Handle disconnection/reconnection
- [ ] **3.2.13** Write tests for Socket.IO events

### 3.3 Session Management

- [ ] **3.3.1** Create `SessionService` class
  - *Source:* [phase-3-network.md](../docs/implementation/phase-3-network.md) Task 3.3
- [ ] **3.3.2** Implement `create(gameId, playerId, playerName)` - generates secure token
- [ ] **3.3.3** Implement `validate(token, gameId?)` - validates session
- [ ] **3.3.4** Implement `invalidate(token)` - removes session
- [ ] **3.3.5** Implement session expiration (24 hours)
- [ ] **3.3.6** Create `authenticateSession` middleware
- [ ] **3.3.7** Write tests for session management

---

## Phase 4: AI Opponent

### 4.1 AI Move Generation

- [ ] **4.1.1** Define `AIPlayer` interface
  - *Source:* [phase-4-ai.md](../docs/implementation/phase-4-ai.md) Task 4.1
- [ ] **4.1.2** Implement `RandomAI` class (easy difficulty)
- [ ] **4.1.3** Write tests for RandomAI (generates valid moves)
- [ ] **4.1.4** Implement position evaluation function for HeuristicAI
- [ ] **4.1.5** Implement move scoring for HeuristicAI
- [ ] **4.1.6** Implement `HeuristicAI` class (medium difficulty)
- [ ] **4.1.7** Write tests for HeuristicAI (prefers winning moves)
- [ ] **4.1.8** Write tests for HeuristicAI (avoids edge for Jarl)
- [ ] **4.1.9** Implement `MinimaxAI` class (hard difficulty) - optional
- [ ] **4.1.10** Add 2-second timeout for AI moves
- [ ] **4.1.11** Write performance tests (<2s response)

### 4.2 AI Game Integration

- [ ] **4.2.1** Add AI player type to game creation
  - *Source:* [phase-4-ai.md](../docs/implementation/phase-4-ai.md) Task 4.2
- [ ] **4.2.2** Implement `addAIPlayer(gameId, difficulty)`
- [ ] **4.2.3** Implement AI name generator (Norse names)
- [ ] **4.2.4** Set up auto-play on AI's turn
- [ ] **4.2.5** Add thinking delay for UX (500-1500ms)
- [ ] **4.2.6** Implement AI takeover for disconnected players
  - *Spec:* [game-rules-v1.md](./game-rules-v1.md) Disconnection Handling
- [ ] **4.2.7** Write tests for AI integration
- [ ] **4.2.8** Write tests for disconnection AI takeover

---

## Phase 5: Frontend

### 5.1 Project Setup

- [ ] **5.1.1** Initialize Vite + TypeScript project in `packages/client`
  - *Source:* [phase-5-frontend.md](../docs/implementation/phase-5-frontend.md) Task 5.1
- [ ] **5.1.2** Install honeycomb-grid
- [ ] **5.1.3** Install Socket.IO client
- [ ] **5.1.4** Configure Vite proxy for API and WebSocket
- [ ] **5.1.5** Create basic HTML structure with canvas element

### 5.2 Hex Grid Rendering

- [ ] **5.2.1** Create `BoardRenderer` class
- [ ] **5.2.2** Implement `hexToPixel(hex, centerX, centerY)` conversion
- [ ] **5.2.3** Implement `pixelToHex(x, y, centerX, centerY)` conversion
- [ ] **5.2.4** Implement `drawHexPath(x, y)` helper
- [ ] **5.2.5** Implement `renderBoardHexes(state)` - draw grid
- [ ] **5.2.6** Implement `renderThrone(centerX, centerY)` - center hex
- [ ] **5.2.7** Implement `renderShield(shield)` - shield pieces
- [ ] **5.2.8** Implement `renderPiece(piece, state)` - warriors and jarls
- [ ] **5.2.9** Implement `renderHighlights(highlights)` - valid moves
- [ ] **5.2.10** Implement `render(state, highlights)` - main render function
- [ ] **5.2.11** Implement `resize()` for responsive scaling
- [ ] **5.2.12** Write visual tests (screenshot comparison)

### 5.3 Input Handling

- [ ] **5.3.1** Create `InputHandler` class
  - *Source:* [phase-5-frontend.md](../docs/implementation/phase-5-frontend.md) Task 5.2
- [ ] **5.3.2** Implement click detection and hex conversion
- [ ] **5.3.3** Implement piece selection
- [ ] **5.3.4** Fetch valid moves on selection
- [ ] **5.3.5** Implement destination selection and move execution
- [ ] **5.3.6** Implement hover for combat preview
- [ ] **5.3.7** Implement touch input for mobile
- [ ] **5.3.8** Implement "not your turn" blocking

### 5.4 Move Animation

- [ ] **5.4.1** Create `AnimationSystem` class
  - *Source:* [phase-5-frontend.md](../docs/implementation/phase-5-frontend.md) Task 5.3
- [ ] **5.4.2** Define easing functions (easeOutQuad, easeOutBack, easeInQuad)
- [ ] **5.4.3** Implement `eventsToAnimations(events)` conversion
- [ ] **5.4.4** Implement staggered timing based on chain depth
- [ ] **5.4.5** Implement animation tick loop with requestAnimationFrame
- [ ] **5.4.6** Implement piece movement animation
- [ ] **5.4.7** Implement elimination animation (fly off board)
- [ ] **5.4.8** Implement `animate(events, state)` returning Promise
- [ ] **5.4.9** Write animation timing tests

### 5.5 Game UI Components

- [ ] **5.5.1** Create TurnIndicator component (whose turn, timer)
  - *Source:* [phase-5-frontend.md](../docs/implementation/phase-5-frontend.md) Task 5.4
- [ ] **5.5.2** Create PlayerList component with piece counts
- [ ] **5.5.3** Create CombatPreview tooltip component
- [ ] **5.5.4** Create GameEndModal component (victory/defeat)
- [ ] **5.5.5** Create StarvationSelection modal
- [ ] **5.5.6** Create ConnectionStatus indicator
- [ ] **5.5.7** Implement responsive layout

### 5.6 Lobby UI

- [ ] **5.6.1** Create CreateGameForm component
  - *Source:* [phase-5-frontend.md](../docs/implementation/phase-5-frontend.md) Task 5.5
- [ ] **5.6.2** Create GameList component
- [ ] **5.6.3** Create JoinGameFlow component
- [ ] **5.6.4** Create GameLobby component (waiting for players)
- [ ] **5.6.5** Create SpectatorEntry component

### 5.7 State Management & Integration

- [ ] **5.7.1** Create game state store
- [ ] **5.7.2** Implement Socket.IO connection hook
- [ ] **5.7.3** Handle real-time state updates
- [ ] **5.7.4** Handle reconnection flow
- [ ] **5.7.5** Write E2E tests for complete game flow

---

## Phase 6: Polish & Production

### 6.1 Error Handling

- [ ] **6.1.1** Define custom error classes (GameNotFoundError, InvalidMoveError, etc.)
  - *Source:* [phase-6-production.md](../docs/implementation/phase-6-production.md) Task 6.1
- [ ] **6.1.2** Implement Express error middleware
- [ ] **6.1.3** Implement client-side error boundary
- [ ] **6.1.4** Implement reconnection retry logic
- [ ] **6.1.5** Add user-friendly error messages

### 6.2 Performance Optimization

- [ ] **6.2.1** Review and optimize database queries
  - *Source:* [phase-6-production.md](../docs/implementation/phase-6-production.md) Task 6.2
- [ ] **6.2.2** Add database indexes if missing
- [ ] **6.2.3** Tune connection pool settings
- [ ] **6.2.4** Optimize client bundle (tree shaking, code splitting)
- [ ] **6.2.5** Run load tests
- [ ] **6.2.6** Fix any memory leaks

### 6.3 Deployment

- [ ] **6.3.1** Create Dockerfile
  - *Source:* [phase-6-production.md](../docs/implementation/phase-6-production.md) Task 6.3
- [ ] **6.3.2** Create docker-compose.prod.yml
- [ ] **6.3.3** Create GitHub Actions CI workflow
- [ ] **6.3.4** Create GitHub Actions CD workflow
- [ ] **6.3.5** Set up health checks
- [ ] **6.3.6** Document rollback procedure

### 6.4 Documentation

- [ ] **6.4.1** Create README with quick start
  - *Source:* [phase-6-production.md](../docs/implementation/phase-6-production.md) Task 6.4
- [ ] **6.4.2** Create in-app help screen
- [ ] **6.4.3** Generate API documentation
- [ ] **6.4.4** Document architecture

---

## Verification Checklist

After completing all phases, verify:

- [ ] 2-player game works end-to-end
- [ ] AI opponent plays correctly at all difficulties
- [ ] Throne victory works (voluntary entry only)
- [ ] Last standing victory works
- [ ] Push chains resolve correctly
- [ ] Throne compression works for both Warriors and Jarls
- [ ] Starvation triggers and resolves correctly
- [ ] Disconnection/reconnection works with AI takeover
- [ ] Turn timeout auto-skips correctly
- [ ] All tests pass
- [ ] No console errors during gameplay

---

*Document Version: 1.0*
*Created: 2026-01-25*
