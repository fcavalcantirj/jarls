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
type PieceType = 'warrior' | 'jarl' | 'shield';

interface Piece {
  id: string;
  type: PieceType;
  owner: string | null; // null for shields
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
  shieldCount: number;
  warriorsPerPlayer: number;
  turnTimerSeconds: number | null; // null = no timer
  starvationRounds: number;
}

// Game phases
type GamePhase = 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';

// Full game state
interface GameState {
  gameId: string;
  config: GameConfig;
  phase: GamePhase;
  players: Player[];
  pieces: Piece[];
  currentPlayerIndex: number;
  turnNumber: number;
  roundNumber: number;
  roundsWithoutElimination: number;
  winner: string | null;
  winCondition: 'throne' | 'last_standing' | null;
  pendingStarvation: StarvationChoice[] | null;
}

// Move command from client
interface MoveCommand {
  pieceId: string;
  to: AxialCoord;
}

// Combat calculation result
interface CombatResult {
  attack: number;
  defense: number;
  attackBreakdown: {
    base: number;
    momentum: number;
    support: number;
  };
  defenseBreakdown: {
    base: number;
    bracing: number;
  };
  outcome: 'push' | 'blocked';
}

// Move result with all events
interface MoveResult {
  success: boolean;
  error?: string;
  combat?: CombatResult;
  events: GameEvent[];
  newState: GameState;
}

// Game events for animation/history
type GameEvent =
  | { type: 'MOVE'; pieceId: string; from: AxialCoord; to: AxialCoord }
  | { type: 'PUSH'; pieceId: string; from: AxialCoord; to: AxialCoord; depth: number }
  | { type: 'ELIMINATED'; pieceId: string; from: AxialCoord; reason: 'edge' | 'starvation' }
  | { type: 'COMPRESSED'; pieceIds: string[]; at: AxialCoord }
  | { type: 'BLOCKED'; attackerId: string; at: AxialCoord }
  | { type: 'PLAYER_ELIMINATED'; playerId: string }
  | { type: 'THRONE_VICTORY'; playerId: string }
  | { type: 'LAST_STANDING'; playerId: string }
  | { type: 'TURN_ENDED'; playerId: string; nextPlayerId: string }
  | { type: 'STARVATION_TRIGGERED'; round: number };

// Starvation choice (when tie-breaker needed)
interface StarvationChoice {
  playerId: string;
  candidates: string[]; // piece IDs equidistant from throne
  choice?: string; // selected piece ID
}
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
- [ ] Implement `generateSymmetricalShields(count, radius, playerCount)` → shield positions
- [ ] Implement `validateShieldPlacement(shields, startPositions)` → path check
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

### Algorithm: Symmetrical Shield Placement

```typescript
function generateSymmetricalShields(
  count: number,
  radius: number,
  playerCount: number
): AxialCoord[] {
  // Generate one shield position randomly (not on throne, not on edge)
  // Rotate it playerCount times to create symmetry
  // Validate paths to throne aren't all blocked
  // If blocked, regenerate
}
```

### Definition of Done

- [ ] Board generates correctly for 2, 3, 4, 5, 6 players
- [ ] All Jarls are exactly equidistant from Throne
- [ ] Shields have rotational symmetry matching player count
- [ ] At least one clear straight-line path to Throne per player
- [ ] No pieces overlap
- [ ] Shields never on edge or Throne

### Test Cases

```typescript
describe('Board Generation', () => {
  test.each([2, 3, 4, 5, 6])('generates valid %i-player board', (playerCount) => {
    const config = getConfigForPlayerCount(playerCount);
    const state = createInitialState(config);

    // Correct piece counts
    const jarls = state.pieces.filter((p) => p.type === 'jarl');
    const warriors = state.pieces.filter((p) => p.type === 'warrior');
    const shields = state.pieces.filter((p) => p.type === 'shield');

    expect(jarls).toHaveLength(playerCount);
    expect(warriors).toHaveLength(playerCount * config.warriorsPerPlayer);
    expect(shields).toHaveLength(config.shieldCount);

    // Equidistant jarls
    const distances = jarls.map((j) => hexDistance(j.position, THRONE));
    expect(new Set(distances).size).toBe(1);

    // No overlaps
    const positions = state.pieces.map((p) => hexToKey(p.position));
    expect(new Set(positions).size).toBe(positions.length);

    // Shields not on edge or throne
    shields.forEach((s) => {
      expect(isOnEdge(s.position, config.boardRadius)).toBe(false);
      expect(hexToKey(s.position)).not.toBe(hexToKey(THRONE));
    });
  });

  test('each player has path to throne', () => {
    const state = createInitialState(getConfigForPlayerCount(4));
    const jarls = state.pieces.filter((p) => p.type === 'jarl');

    jarls.forEach((jarl) => {
      expect(hasDirectPathToThrone(state, jarl.position)).toBe(true);
    });
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

### Validation Errors

```typescript
type MoveError =
  | 'INVALID_PIECE' // Piece doesn't exist
  | 'NOT_YOUR_PIECE' // Piece belongs to another player
  | 'NOT_YOUR_TURN' // Not this player's turn
  | 'GAME_NOT_PLAYING' // Game not in playing phase
  | 'OUT_OF_RANGE' // Destination too far
  | 'PATH_BLOCKED' // Piece in movement path
  | 'INVALID_DESTINATION' // Off board or on friendly
  | 'NO_DRAFT_FORMATION' // Jarl 2-hex without draft
  | 'WARRIOR_CANNOT_ENTER_THRONE';

interface ValidationResult {
  valid: boolean;
  error?: MoveError;
  moveType?: 'move' | 'attack';
  hasMomentum?: boolean;
  combat?: CombatResult;
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
    const result = validateMove(state, 'player1', { pieceId: 'w1', to: emptyHex });
    expect(result.valid).toBe(true);
    expect(result.moveType).toBe('move');
  });

  test('valid warrior 2-hex move with momentum', () => {
    const result = validateMove(state, 'player1', { pieceId: 'w1', to: twoHexAway });
    expect(result.valid).toBe(true);
    expect(result.hasMomentum).toBe(true);
  });

  test('rejects move on wrong turn', () => {
    const result = validateMove(state, 'player2', { pieceId: 'w1', to: anyHex });
    expect(result).toEqual({ valid: false, error: 'NOT_YOUR_TURN' });
  });

  test('rejects path blocked', () => {
    const result = validateMove(stateWithBlockedPath, 'player1', {
      pieceId: 'w1',
      to: behindBlocker,
    });
    expect(result).toEqual({ valid: false, error: 'PATH_BLOCKED' });
  });

  test('rejects warrior entering throne', () => {
    const result = validateMove(stateNearThrone, 'player1', { pieceId: 'w1', to: THRONE });
    expect(result).toEqual({ valid: false, error: 'WARRIOR_CANNOT_ENTER_THRONE' });
  });

  test('allows jarl entering throne', () => {
    const result = validateMove(stateNearThrone, 'player1', { pieceId: 'j1', to: THRONE });
    expect(result.valid).toBe(true);
  });

  test('jarl 2-hex requires draft', () => {
    const result = validateMove(stateWithoutDraft, 'player1', { pieceId: 'j1', to: twoHexAway });
    expect(result).toEqual({ valid: false, error: 'NO_DRAFT_FORMATION' });
  });

  test('jarl 2-hex allowed with draft', () => {
    const result = validateMove(stateWithDraft, 'player1', { pieceId: 'j1', to: twoHexAway });
    expect(result.valid).toBe(true);
    expect(result.hasMomentum).toBe(true);
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
  // All examples from ruleset v0.4.1

  test('W → W (1 hex, both alone) = BLOCKED', () => {
    const result = calculateCombat(state, warriorPos, enemyPos, 1);
    expect(result).toEqual({
      attack: 1,
      defense: 1,
      outcome: 'blocked',
      attackBreakdown: { base: 1, momentum: 0, support: 0 },
      defenseBreakdown: { base: 1, bracing: 0 },
    });
  });

  test('W →→ W (2 hex, momentum) = PUSH', () => {
    const result = calculateCombat(state, warriorPos, enemyPos, 2);
    expect(result.attack).toBe(2);
    expect(result.defense).toBe(1);
    expect(result.outcome).toBe('push');
  });

  test('W W → W (inline support) = PUSH', () => {
    const result = calculateCombat(stateWithSupport, frontWarrior, enemy, 1);
    expect(result.attack).toBe(2); // 1 base + 1 support
    expect(result.outcome).toBe('push');
  });

  test('W → W ← W (braced) = BLOCKED', () => {
    const result = calculateCombat(stateWithBraced, attacker, defender, 1);
    expect(result.defense).toBe(2); // 1 base + 1 brace
    expect(result.outcome).toBe('blocked');
  });

  test('J → W = PUSH', () => {
    const result = calculateCombat(state, jarlPos, warriorPos, 1);
    expect(result.attack).toBe(2);
    expect(result.defense).toBe(1);
    expect(result.outcome).toBe('push');
  });

  test('J → J = BLOCKED', () => {
    const result = calculateCombat(state, jarl1Pos, jarl2Pos, 1);
    expect(result.attack).toBe(2);
    expect(result.defense).toBe(2);
    expect(result.outcome).toBe('blocked');
  });

  test('W with Jarl behind → W = Attack 3', () => {
    const result = calculateCombat(stateWithJarlSupport, warriorPos, enemyPos, 1);
    expect(result.attack).toBe(3); // 1 base + 2 jarl support
    expect(result.attackBreakdown.support).toBe(2);
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
- [ ] Implement `resolveCompression(state, chain, blocker)` → events
- [ ] Implement `resolvePush(state, attackerPos, direction)` → PushResult
- [ ] Handle Throne compression for Warriors
- [ ] Handle multi-piece elimination chains

### Chain Detection

```typescript
interface ChainResult {
  pieces: Piece[]; // Pieces in chain, front to back
  terminator: 'empty' | 'edge' | 'shield' | 'throne';
  terminatorPos?: AxialCoord;
}

function detectChain(state, startPos, direction): ChainResult {
  // Walk in direction, collecting pieces until we hit:
  // - Empty hex → 'empty'
  // - Board edge → 'edge'
  // - Shield → 'shield'
  // - Throne (and piece is warrior) → 'throne'
}
```

### Definition of Done

- [ ] Simple pushes work (into empty hex)
- [ ] Edge elimination works (piece falls off)
- [ ] Shield compression works (pieces stack against shield)
- [ ] Throne compression works (Warriors stop at edge)
- [ ] Multi-piece chains work correctly
- [ ] Events generated in correct animation order (with depth)

### Test Cases

```typescript
describe('Push Chain Resolution', () => {
  test('simple push into empty', () => {
    const result = resolvePush(state, attackerPos, direction);
    expect(result.events).toEqual([
      { type: 'MOVE', pieceId: 'attacker', from: attackerPos, to: defenderPos },
      { type: 'PUSH', pieceId: 'defender', from: defenderPos, to: emptyPos, depth: 0 },
    ]);
  });

  test('edge elimination', () => {
    const result = resolvePush(stateAtEdge, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'ELIMINATED',
      pieceId: 'defender',
      from: edgePos,
      reason: 'edge',
    });
    expect(result.eliminations).toContain('defender');
  });

  test('shield compression', () => {
    // A →→ W1 ← W2 ← [Shield]
    const result = resolvePush(stateWithShield, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'COMPRESSED',
      pieceIds: ['w1', 'w2'],
      at: shieldAdjacentPos,
    });
    // No eliminations
    expect(result.eliminations).toHaveLength(0);
  });

  test('throne compression for warriors', () => {
    // A →→ W ← W ← [Throne]
    const result = resolvePush(stateNearThrone, attackerPos, direction);
    expect(result.events).toContainEqual({
      type: 'COMPRESSED',
      pieceIds: ['w1', 'w2'],
      at: throneAdjacentPos,
    });
  });

  test('multi-elimination chain', () => {
    // A →→ W1 ← W2 ← W3 [edge]
    // W3 should be eliminated, W2 stops at edge
    const result = resolvePush(stateMultiChain, attackerPos, direction);
    expect(result.eliminations).toEqual(['w3']);
    expect(result.newState.pieces.find((p) => p.id === 'w2')?.position).toEqual(edgePos);
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
- [ ] Being pushed onto Throne does NOT trigger victory

### Test Cases

```typescript
describe('Win Conditions', () => {
  test('throne victory on voluntary entry', () => {
    const result = applyMove(stateNearThrone, 'player1', { pieceId: 'j1', to: THRONE });
    expect(result.newState.winner).toBe('player1');
    expect(result.newState.winCondition).toBe('throne');
    expect(result.events).toContainEqual({ type: 'THRONE_VICTORY', playerId: 'player1' });
  });

  test('pushed onto throne does not win', () => {
    const result = resolvePush(statePushOntoThrone, attackerPos, direction);
    expect(result.newState.winner).toBeNull();
  });

  test('last standing after elimination', () => {
    const result = eliminatePlayer(stateTwoPlayers, 'player2');
    expect(result.winner).toBe('player1');
    expect(result.winCondition).toBe('last_standing');
  });

  test('player elimination removes all pieces', () => {
    const beforeCount = state.pieces.filter((p) => p.owner === 'player2').length;
    expect(beforeCount).toBeGreaterThan(0);

    const result = eliminatePlayer(state, 'player2');
    const afterCount = result.pieces.filter((p) => p.owner === 'player2').length;
    expect(afterCount).toBe(0);
  });

  test('throne takes precedence over last standing', () => {
    // Scenario: Player1 moves Jarl to Throne, which would also eliminate Player2
    // (hypothetical edge case)
    const result = applyMove(complexState, 'player1', moveToThrone);
    expect(result.newState.winCondition).toBe('throne');
  });
});
```

---

## Task 1.8: Starvation Mechanic

### Description

Implement starvation rule for stalemate prevention.

### Work Items

- [ ] Track `roundsWithoutElimination` in state
- [ ] Implement `checkStarvationTrigger(state)` → boolean
- [ ] Implement `calculateStarvationCandidates(state)` → by player
- [ ] Implement `resolveStarvation(state, choices)` → new state
- [ ] Handle immediate Jarl risk when player has no Warriors
- [ ] Reset counter when elimination occurs

### Definition of Done

- [ ] Starvation triggers after 10 rounds without elimination
- [ ] Correct Warriors selected (furthest from Throne)
- [ ] Tie-breaker returns candidates for player choice
- [ ] Repeats every 5 rounds
- [ ] Jarl starvation when no Warriors left
- [ ] Counter resets on any elimination

### Test Cases

```typescript
describe('Starvation Mechanic', () => {
  test('triggers at round 10 without elimination', () => {
    const state = simulateRoundsWithoutElimination(initialState, 10);
    expect(checkStarvationTrigger(state)).toBe(true);
  });

  test('does not trigger before round 10', () => {
    const state = simulateRoundsWithoutElimination(initialState, 9);
    expect(checkStarvationTrigger(state)).toBe(false);
  });

  test('resets counter on elimination', () => {
    const state1 = simulateRoundsWithoutElimination(initialState, 8);
    const state2 = simulateElimination(state1);
    expect(state2.roundsWithoutElimination).toBe(0);
  });

  test('selects furthest warrior from throne', () => {
    const candidates = calculateStarvationCandidates(state);
    candidates.forEach((c) => {
      // Verify selected warrior is furthest
      const selected = state.pieces.find((p) => p.id === c.candidates[0]);
      const otherWarriors = state.pieces.filter(
        (p) => p.owner === c.playerId && p.type === 'warrior' && p.id !== c.candidates[0]
      );
      otherWarriors.forEach((w) => {
        expect(hexDistance(selected.position, THRONE)).toBeGreaterThanOrEqual(
          hexDistance(w.position, THRONE)
        );
      });
    });
  });

  test('returns multiple candidates for tie-breaker', () => {
    const candidates = calculateStarvationCandidates(stateWithTie);
    const playerCandidates = candidates.find((c) => c.playerId === 'player1');
    expect(playerCandidates.candidates.length).toBeGreaterThan(1);
  });

  test('jarl at risk when no warriors', () => {
    const state = createStateWithNoWarriors('player1');
    const candidates = calculateStarvationCandidates(state);
    const p1 = candidates.find((c) => c.playerId === 'player1');
    expect(p1.candidates[0]).toBe('j1'); // Jarl is the candidate
  });
});
```

---

## Task 1.9: Valid Moves Calculator

### Description

Calculate all valid moves for a piece (for UI highlighting).

### Work Items

- [ ] Implement `getValidMoves(state, playerId, pieceId)` → ValidMove[]
- [ ] Calculate reachable hexes based on piece type
- [ ] Filter by path availability
- [ ] Classify move types (move, attack)
- [ ] Include combat preview for attacks
- [ ] Include draft/momentum info

### Return Type

```typescript
interface ValidMove {
  to: AxialCoord;
  type: 'move' | 'attack';
  hasMomentum: boolean;
  combat?: CombatResult; // Only for attacks
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
    const moves = getValidMoves(openState, 'player1', 'w1');
    expect(moves.length).toBeLessThanOrEqual(12);
    moves.forEach((m) => {
      expect(hexDistance(warriorPos, m.to)).toBeLessThanOrEqual(2);
    });
  });

  test('jarl without draft returns only 6 hexes', () => {
    const moves = getValidMoves(stateWithoutDraft, 'player1', 'j1');
    moves.forEach((m) => {
      expect(hexDistance(jarlPos, m.to)).toBe(1);
    });
  });

  test('jarl with draft includes 2-hex moves', () => {
    const moves = getValidMoves(stateWithDraft, 'player1', 'j1');
    const twoHexMoves = moves.filter((m) => hexDistance(jarlPos, m.to) === 2);
    expect(twoHexMoves.length).toBeGreaterThan(0);
    twoHexMoves.forEach((m) => {
      expect(m.hasMomentum).toBe(true);
    });
  });

  test('attacks include combat preview', () => {
    const moves = getValidMoves(stateWithEnemy, 'player1', 'w1');
    const attacks = moves.filter((m) => m.type === 'attack');
    attacks.forEach((a) => {
      expect(a.combat).toBeDefined();
      expect(a.combat.attack).toBeGreaterThan(0);
      expect(a.combat.defense).toBeGreaterThan(0);
    });
  });

  test('performance under 10ms', () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      getValidMoves(complexState, 'player1', 'w1');
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

- [ ] All 9 tasks complete
- [ ] 100% test coverage on core logic
- [ ] All ruleset v0.4.1 scenarios pass
- [ ] No TypeScript errors
- [ ] Code reviewed

### Handoff to Phase 2

- All game logic implemented as pure functions
- Types defined and exported from shared
- Ready to integrate with state machine

---

_Phase 1 Status: Not Started_
