# Phase 1: Core Game Logic

## Overview

Implement all game logic without network layer. Pure functions that take state and return new state.

**Prerequisites:** Phase 0 complete
**Estimated Effort:** 5-7 days
**Package:** `@jarls/shared` (logic) + `@jarls/server` (tests)

---

## Task 1.1: Hex Coordinate System

### Description

Implement cube/axial coordinate system with all required operations.

### Work Items

- [ ] Define `CubeCoord` interface `{ q, r, s }`
- [ ] Define `AxialCoord` interface `{ q, r }`
- [ ] Implement `axialToCube()` and `cubeToAxial()`
- [ ] Implement `hexDistance(a, b)`
- [ ] Implement `getNeighbor(hex, direction)`
- [ ] Implement `getAllNeighbors(hex)`
- [ ] Implement `hexLine(a, b)` with rounding
- [ ] Implement `isOnBoard(hex, radius)`
- [ ] Implement `isOnEdge(hex, radius)`
- [ ] Implement `rotate60CW(hex)` and `rotate60CCW(hex)`
- [ ] Implement `rotateAround(hex, center, steps)`
- [ ] Implement `getEdgeRing(radius)` - all hexes at distance
- [ ] Implement `hexToKey(hex)` and `keyToHex(key)` for Map storage

### Type Definitions

```typescript
interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

interface AxialCoord {
  q: number;
  r: number;
}

type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

const DIRECTIONS: readonly CubeCoord[] = [
  { q: +1, r: 0, s: -1 }, // 0: East
  { q: +1, r: -1, s: 0 }, // 1: Northeast
  { q: 0, r: -1, s: +1 }, // 2: Northwest
  { q: -1, r: 0, s: +1 }, // 3: West
  { q: -1, r: +1, s: 0 }, // 4: Southwest
  { q: 0, r: +1, s: -1 }, // 5: Southeast
];
```

### Definition of Done

- [ ] All coordinate functions implemented
- [ ] 100% unit test coverage for hex math
- [ ] All functions are pure (no side effects)
- [ ] Performance: <1ms for any single operation

### Test Cases

```typescript
describe('Hex Coordinates', () => {
  // Distance
  test('distance from origin', () => {
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 2, r: -1, s: -1 })).toBe(2);
    expect(hexDistance({ q: 0, r: 0, s: 0 }, { q: 3, r: 0, s: -3 })).toBe(3);
  });

  // Neighbors
  test('all neighbors', () => {
    const neighbors = getAllNeighbors({ q: 0, r: 0, s: 0 });
    expect(neighbors).toHaveLength(6);
    neighbors.forEach((n) => {
      expect(hexDistance({ q: 0, r: 0, s: 0 }, n)).toBe(1);
    });
  });

  // Line drawing
  test('line between hexes', () => {
    const line = hexLine({ q: 0, r: 0, s: 0 }, { q: 3, r: 0, s: -3 });
    expect(line).toHaveLength(4); // includes both endpoints
    expect(line[0]).toEqual({ q: 0, r: 0, s: 0 });
    expect(line[3]).toEqual({ q: 3, r: 0, s: -3 });
  });

  // Edge detection
  test('edge detection', () => {
    expect(isOnEdge({ q: 3, r: 0, s: -3 }, 3)).toBe(true);
    expect(isOnEdge({ q: 1, r: 0, s: -1 }, 3)).toBe(false);
    expect(isOnEdge({ q: 0, r: 3, s: -3 }, 3)).toBe(true);
  });

  // Board bounds
  test('board bounds', () => {
    expect(isOnBoard({ q: 2, r: 1, s: -3 }, 3)).toBe(true);
    expect(isOnBoard({ q: 4, r: 0, s: -4 }, 3)).toBe(false);
  });

  // Rotation
  test('60 degree rotation', () => {
    expect(rotate60CW({ q: 1, r: 0, s: -1 })).toEqual({ q: 1, r: -1, s: 0 });
    expect(rotate60CCW({ q: 1, r: 0, s: -1 })).toEqual({ q: 0, r: 1, s: -1 });
  });
});
```

---

## Task 1.2: Game State Types

### Description

Define all TypeScript interfaces for game state.

### Work Items

- [ ] Define `PieceType` enum
- [ ] Define `Piece` interface
- [ ] Define `Player` interface
- [ ] Define `GameConfig` interface
- [ ] Define `GamePhase` enum
- [ ] Define `GameState` interface
- [ ] Define `MoveCommand` interface
- [ ] Define `MoveResult` interface
- [ ] Define `GameEvent` union type
- [ ] Define `CombatResult` interface

### Type Definitions

```typescript
// Piece types
type PieceType = 'warrior' | 'jarl';

interface Piece {
  id: string;
  type: PieceType;
  playerId: string | null;
  position: AxialCoord;
}

// Player
interface Player {
  id: string;
  name: string;
  color: string;
  isEliminated: boolean;
  isAI: boolean;
  aiDifficulty?: 'easy' | 'medium' | 'hard';
}

// Game configuration
interface GameConfig {
  playerCount: number;
  boardRadius: number;
  warriorsPerPlayer: number;
  turnTimerMs: number | null; // null = no timer
  terrain: 'calm' | 'treacherous' | 'chaotic';
}

// Game phases
type GamePhase = 'lobby' | 'setup' | 'playing' | 'ended';

// Full game state
interface GameState {
  id: string;
  config: GameConfig;
  phase: GamePhase;
  players: Player[];
  pieces: Piece[];
  holes: AxialCoord[];
  currentPlayerId: string | null;
  turnNumber: number;
  roundNumber: number;
  firstPlayerIndex: number;
  roundsSinceElimination: number;
  winnerId: string | null;
  winCondition: 'throne' | 'lastStanding' | null;
  moveHistory: MoveHistoryEntry[];
}

// Move command from client
interface MoveCommand {
  pieceId: string;
  destination: AxialCoord;
}

// Combat calculation result
interface CombatResult {
  attackerId: string;
  defenderId: string;
  attack: CombatBreakdown;
  defense: CombatBreakdown;
  outcome: 'push' | 'blocked';
  pushDirection: HexDirection | null;
}

interface CombatBreakdown {
  baseStrength: number;
  momentum: number;
  support: number;
  total: number;
}

// Move result with all events
interface MoveResult {
  success: boolean;
  error?: string;
  events: GameEvent[];
  newState: GameState;
}

// Game events for animation/history
type GameEvent =
  | { type: 'MOVE'; pieceId: string; from: AxialCoord; to: AxialCoord; hasMomentum: boolean }
  | {
      type: 'PUSH';
      pieceId: string;
      from: AxialCoord;
      to: AxialCoord;
      pushDirection: HexDirection;
      depth: number;
    }
  | {
      type: 'ELIMINATED';
      pieceId: string;
      playerId: string | null;
      position: AxialCoord;
      cause: 'edge' | 'hole';
    }
  | { type: 'TURN_ENDED'; playerId: string; nextPlayerId: string; turnNumber: number }
  | { type: 'GAME_ENDED'; winnerId: string; winCondition: 'throne' | 'lastStanding' };
```

### Definition of Done

- [ ] All interfaces defined in `@jarls/shared`
- [ ] Interfaces match ruleset v0.4.1 exactly
- [ ] JSDoc comments on all interfaces
- [ ] No `any` types
- [ ] Exported from shared package index

### Test Verification

```typescript
// TypeScript compilation is the test
// Verify types are usable
const state: GameState = createInitialState(config);
const result: MoveResult = applyMove(state, command);
```

---

## Task 1.3: Board Generation

### Description

Generate valid game boards with proper setup according to rules.

### Work Items

- [ ] Implement `generateBoard(config)` → generates all hexes
- [ ] Implement `calculateStartingPositions(playerCount, radius)` → equidistant Jarl positions
- [ ] Implement `generateHoles(terrain, radius)` → hole positions based on terrain type
- [ ] Implement `placeWarriors(jarlPosition, count, radius)` → warriors in front
- [ ] Implement `createInitialState(config)` → full initial state

### Algorithm: Equidistant Starting Positions

```typescript
function calculateStartingPositions(playerCount: number, radius: number): AxialCoord[] {
  // Players start on edge, evenly spaced
  // For N players, positions are at angles: 0, 360/N, 2*360/N, ...
  // Map angles to edge hexes
}
```

### Definition of Done

- [ ] Board generates correctly for 2, 3, 4, 5, 6 players
- [ ] All Jarls are exactly equidistant from Throne
- [ ] Holes generated based on terrain type
- [ ] No pieces overlap
- [ ] Holes never on edge or Throne or starting positions

### Test Cases

```typescript
describe('Board Generation', () => {
  test.each([2, 3, 4, 5, 6])('generates valid %i-player board', (playerCount) => {
    const config = getConfigForPlayerCount(playerCount);
    const state = createInitialState(config);

    // Correct piece counts
    const jarls = state.pieces.filter((p) => p.type === 'jarl');
    const warriors = state.pieces.filter((p) => p.type === 'warrior');

    expect(jarls).toHaveLength(playerCount);
    expect(warriors).toHaveLength(playerCount * config.warriorsPerPlayer);

    // Equidistant jarls
    const distances = jarls.map((j) => hexDistance(j.position, THRONE));
    expect(new Set(distances).size).toBe(1);

    // No overlaps
    const positions = state.pieces.map((p) => hexToKey(p.position));
    expect(new Set(positions).size).toBe(positions.length);
  });

  test('holes generated based on terrain', () => {
    const calmState = createInitialState({ ...config, terrain: 'calm' });
    const chaoticState = createInitialState({ ...config, terrain: 'chaotic' });

    expect(calmState.holes.length).toBeLessThan(chaoticState.holes.length);
  });
});
```

---

## Task 1.4: Move Validation

### Description

Validate all move types according to rules.

### Work Items

- [ ] Implement `validateMove(state, playerId, command)` → ValidationResult
- [ ] Check piece ownership
- [ ] Check turn order
- [ ] Check piece type movement range
- [ ] Check path is clear
- [ ] Check destination validity
- [ ] Implement draft detection for Jarl 2-hex moves
- [ ] Check Warriors cannot enter Throne
- [ ] Check cannot move into holes

### Validation Errors

```typescript
type MoveValidationError =
  | 'PIECE_NOT_FOUND'
  | 'NOT_YOUR_PIECE'
  | 'NOT_YOUR_TURN'
  | 'GAME_NOT_PLAYING'
  | 'DESTINATION_OFF_BOARD'
  | 'DESTINATION_OCCUPIED_FRIENDLY'
  | 'DESTINATION_IS_HOLE'
  | 'WARRIOR_CANNOT_ENTER_THRONE'
  | 'INVALID_DISTANCE_WARRIOR'
  | 'INVALID_DISTANCE_JARL'
  | 'JARL_NEEDS_DRAFT_FOR_TWO_HEX'
  | 'PATH_BLOCKED'
  | 'MOVE_NOT_STRAIGHT_LINE';

interface MoveValidation {
  isValid: boolean;
  error?: MoveValidationError;
  hasMomentum?: boolean;
  adjustedDestination?: AxialCoord;
}
```

### Definition of Done

- [ ] All valid moves accepted
- [ ] All invalid moves rejected with specific error code
- [ ] Combat preview included for attack moves
- [ ] Draft detection works correctly

### Test Cases

```typescript
describe('Move Validation', () => {
  test('valid warrior 1-hex move', () => {
    const result = validateMove(state, 'player1', { pieceId: 'w1', destination: emptyHex });
    expect(result.isValid).toBe(true);
  });

  test('valid warrior 2-hex move with momentum', () => {
    const result = validateMove(state, 'player1', { pieceId: 'w1', destination: twoHexAway });
    expect(result.isValid).toBe(true);
    expect(result.hasMomentum).toBe(true);
  });

  test('rejects move on wrong turn', () => {
    const result = validateMove(state, 'player2', { pieceId: 'w1', destination: anyHex });
    expect(result).toEqual({ isValid: false, error: 'NOT_YOUR_TURN' });
  });

  test('rejects warrior entering throne', () => {
    const result = validateMove(stateNearThrone, 'player1', { pieceId: 'w1', destination: THRONE });
    expect(result).toEqual({ isValid: false, error: 'WARRIOR_CANNOT_ENTER_THRONE' });
  });

  test('allows jarl entering throne', () => {
    const result = validateMove(stateNearThrone, 'player1', { pieceId: 'j1', destination: THRONE });
    expect(result.isValid).toBe(true);
  });

  test('jarl 2-hex requires draft', () => {
    const result = validateMove(stateWithoutDraft, 'player1', {
      pieceId: 'j1',
      destination: twoHexAway,
    });
    expect(result).toEqual({ isValid: false, error: 'JARL_NEEDS_DRAFT_FOR_TWO_HEX' });
  });
});
```

---

## Task 1.5: Combat Resolution

### Description

Calculate attack/defense and resolve push outcomes.

### Work Items

- [ ] Implement `calculateAttack(state, attackerPos, direction, hexesMoved)`
- [ ] Implement `calculateDefense(state, defenderPos, pushDirection)`
- [ ] Implement `findInlineSupport(state, pos, direction)` → piece IDs
- [ ] Implement `findBracing(state, pos, direction)` → piece IDs
- [ ] Implement `calculateCombat(state, attackerPos, defenderPos, hexesMoved)`

### Combat Formulas

```typescript
// Attack = base strength + momentum + inline support
function calculateAttack(state, attackerPos, direction, hexesMoved): number {
  const attacker = getPieceAt(state, attackerPos);
  const base = attacker.type === 'jarl' ? 2 : 1;
  const momentum = hexesMoved === 2 ? 1 : 0;
  const support = findInlineSupport(state, attackerPos, oppositeDirection(direction)).reduce(
    (sum, piece) => sum + (piece.type === 'jarl' ? 2 : 1),
    0
  );
  return base + momentum + support;
}

// Defense = base strength + bracing
function calculateDefense(state, defenderPos, pushDirection): number {
  const defender = getPieceAt(state, defenderPos);
  const base = defender.type === 'jarl' ? 2 : 1;
  const bracing = findBracing(state, defenderPos, pushDirection).reduce(
    (sum, piece) => sum + (piece.type === 'jarl' ? 2 : 1),
    0
  );
  return base + bracing;
}
```

### Definition of Done

- [ ] All combat calculations match ruleset examples exactly
- [ ] Momentum correctly applied for 2-hex moves
- [ ] Inline support chains correctly calculated
- [ ] Bracing chains correctly calculated
- [ ] Returns detailed breakdown for UI

### Test Cases

```typescript
describe('Combat Resolution', () => {
  test('W → W (1 hex, both alone) = BLOCKED', () => {
    const result = calculateCombat(state, warriorPos, enemyPos, 1);
    expect(result.attack.total).toBe(1);
    expect(result.defense.total).toBe(1);
    expect(result.outcome).toBe('blocked');
  });

  test('W →→ W (2 hex, momentum) = PUSH', () => {
    const result = calculateCombat(state, warriorPos, enemyPos, 2);
    expect(result.attack.total).toBe(2);
    expect(result.defense.total).toBe(1);
    expect(result.outcome).toBe('push');
  });

  test('J → W = PUSH', () => {
    const result = calculateCombat(state, jarlPos, warriorPos, 1);
    expect(result.attack.total).toBe(2);
    expect(result.defense.total).toBe(1);
    expect(result.outcome).toBe('push');
  });

  test('J → J = BLOCKED', () => {
    const result = calculateCombat(state, jarl1Pos, jarl2Pos, 1);
    expect(result.attack.total).toBe(2);
    expect(result.defense.total).toBe(2);
    expect(result.outcome).toBe('blocked');
  });
});
```

---

## Task 1.6: Push Chain Resolution

### Description

Resolve chain pushes including compression and elimination.

### Work Items

- [ ] Implement `detectChain(state, startPos, direction)` → ChainResult
- [ ] Implement `resolveSimplePush(state, chain)` → events
- [ ] Implement `resolveEdgePush(state, chain)` → events + eliminations
- [ ] Implement `resolveHolePush(state, chain)` → events + eliminations
- [ ] Implement `resolveCompression(state, chain, blocker)` → events
- [ ] Implement `resolvePush(state, attackerPos, direction)` → PushResult
- [ ] Handle Throne compression for all pieces
- [ ] Handle multi-piece elimination chains

### Chain Detection

```typescript
interface ChainResult {
  pieces: Piece[]; // Pieces in chain, front to back
  terminator: 'empty' | 'edge' | 'hole' | 'throne';
  terminatorPosition: AxialCoord;
}

function detectChain(state, startPos, direction): ChainResult {
  // Walk in direction, collecting pieces until we hit:
  // - Empty hex → 'empty'
  // - Board edge → 'edge'
  // - Hole → 'hole'
  // - Throne → 'throne'
}
```

### Definition of Done

- [ ] Simple pushes work (into empty hex)
- [ ] Edge elimination works (piece falls off)
- [ ] Hole elimination works (piece falls in)
- [ ] Throne compression works (pieces stop at edge)
- [ ] Multi-piece chains work correctly
- [ ] Events generated in correct animation order (with depth)

### Test Cases

```typescript
describe('Push Chain Resolution', () => {
  test('simple push into empty', () => {
    const result = resolvePush(state, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'PUSH',
      pieceId: 'defender',
      from: defenderPos,
      to: emptyPos,
      depth: 0,
    });
  });

  test('edge elimination', () => {
    const result = resolvePush(stateAtEdge, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'ELIMINATED',
      pieceId: 'defender',
      cause: 'edge',
    });
  });

  test('hole elimination', () => {
    const result = resolvePush(stateNearHole, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'ELIMINATED',
      pieceId: 'defender',
      cause: 'hole',
    });
  });

  test('throne compression for warriors', () => {
    // A →→ W ← W ← [Throne]
    const result = resolvePush(stateNearThrone, attackerPos, direction);
    // Warriors compress at throne, no eliminations
    expect(result.eliminatedPieceIds).toHaveLength(0);
  });
});
```

---

## Task 1.7: Win Condition Detection

### Description

Detect both win conditions and handle player elimination.

### Work Items

- [ ] Implement `checkThroneVictory(state, pieceId, destination)` → boolean
- [ ] Implement `checkLastStanding(state)` → winnerId | null
- [ ] Implement `eliminatePlayer(state, playerId)` → new state
- [ ] Implement `checkWinConditions(state)` → WinResult | null
- [ ] Handle win precedence (Throne > Last Standing)

### Definition of Done

- [ ] Throne victory detected immediately when Jarl enters voluntarily
- [ ] Last Standing detected after elimination leaves one Jarl
- [ ] Player elimination removes all their remaining pieces
- [ ] Win precedence correctly applied
- [ ] Being pushed onto Throne does NOT trigger victory (compression prevents it)

### Test Cases

```typescript
describe('Win Conditions', () => {
  test('throne victory on voluntary entry', () => {
    const result = applyMove(stateNearThrone, 'player1', { pieceId: 'j1', destination: THRONE });
    expect(result.newState.winnerId).toBe('player1');
    expect(result.newState.winCondition).toBe('throne');
  });

  test('last standing after jarl elimination', () => {
    const result = eliminatePlayer(stateTwoPlayers, 'player2');
    expect(result.winnerId).toBe('player1');
    expect(result.winCondition).toBe('lastStanding');
  });

  test('player elimination removes all pieces', () => {
    const beforeCount = state.pieces.filter((p) => p.playerId === 'player2').length;
    expect(beforeCount).toBeGreaterThan(0);

    const result = eliminatePlayer(state, 'player2');
    const afterCount = result.pieces.filter((p) => p.playerId === 'player2').length;
    expect(afterCount).toBe(0);
  });
});
```

---

## Task 1.8: Valid Moves Calculator

### Description

Calculate all valid moves for a piece (for UI highlighting).

### Work Items

- [ ] Implement `getValidMoves(state, pieceId)` → ValidMove[]
- [ ] Calculate reachable hexes based on piece type
- [ ] Filter by path availability
- [ ] Classify move types (move, attack)
- [ ] Include combat preview for attacks
- [ ] Include momentum info

### Return Type

```typescript
interface ValidMove {
  destination: AxialCoord;
  moveType: 'move' | 'attack';
  hasMomentum: boolean;
  combatPreview: CombatResult | null;
}
```

### Definition of Done

- [ ] Returns all valid destinations for piece
- [ ] Correctly distinguishes move vs attack
- [ ] Includes accurate combat preview
- [ ] Handles draft mechanics for Jarl
- [ ] Performance: <10ms for calculation

### Test Cases

```typescript
describe('Valid Moves Calculator', () => {
  test('warrior returns up to 12 hexes (6 at distance 1, 6 at distance 2)', () => {
    const moves = getValidMoves(openState, 'w1');
    expect(moves.length).toBeLessThanOrEqual(12);
    moves.forEach((m) => {
      expect(hexDistance(warriorPos, m.destination)).toBeLessThanOrEqual(2);
    });
  });

  test('jarl without draft returns only 6 hexes', () => {
    const moves = getValidMoves(stateWithoutDraft, 'j1');
    moves.forEach((m) => {
      expect(hexDistance(jarlPos, m.destination)).toBe(1);
    });
  });

  test('attacks include combat preview', () => {
    const moves = getValidMoves(stateWithEnemy, 'w1');
    const attacks = moves.filter((m) => m.moveType === 'attack');
    attacks.forEach((a) => {
      expect(a.combatPreview).toBeDefined();
    });
  });

  test('performance under 10ms', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      getValidMoves(complexState, 'w1');
    }
    const elapsed = Date.now() - start;
    expect(elapsed / 100).toBeLessThan(10);
  });
});
```

---

## Phase 1 Checklist

### Prerequisites

- [ ] Phase 0 complete
- [ ] All packages set up

### Completion Criteria

- [ ] All 8 tasks complete
- [ ] 100% test coverage on core logic
- [ ] All ruleset v0.4.1 scenarios pass
- [ ] No TypeScript errors
- [ ] Code reviewed

### Handoff to Phase 2

- All game logic implemented as pure functions
- Types defined and exported from shared
- Ready to integrate with state machine

---

_Phase 1 Status: Complete_
_Updated: 2026-02-01_
_Removed: Starvation mechanic, Shield pieces_
