// @jarls/shared - Type definitions
// This file contains all type, interface, and const definitions for the shared package.

// ============================================================================
// Hexagonal Coordinate Types
// ============================================================================

/**
 * Axial coordinates for hexagonal grids.
 * Uses q (column) and r (row) coordinates.
 */
export interface AxialCoord {
  q: number;
  r: number;
}

/**
 * Cube coordinates for hexagonal grids.
 * Uses q, r, s coordinates where q + r + s = 0.
 */
export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

/**
 * Hex direction type (0-5 for 6 directions).
 * Direction 0 is East, then counter-clockwise: NE, NW, W, SW, SE.
 */
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Game Piece Types
// ============================================================================

/** Types of pieces in the game */
export type PieceType = 'jarl' | 'warrior' | 'shield';

/** A game piece (Jarl, Warrior, or Shield) */
export interface Piece {
  id: string;
  type: PieceType;
  playerId: string | null; // null for shields
  position: AxialCoord;
}

// ============================================================================
// Player Types
// ============================================================================

/** A player in the game */
export interface Player {
  id: string;
  name: string;
  color: string;
  isEliminated: boolean;
}

// ============================================================================
// Game Configuration Types
// ============================================================================

/** Game configuration based on player count */
export interface GameConfig {
  playerCount: number;
  boardRadius: number;
  shieldCount: number;
  warriorCount: number;
  turnTimerMs: number | null;
}

/** Internal type for player scaling lookup */
export interface PlayerScaling {
  boardRadius: number;
  shieldCount: number;
  warriorCount: number;
}

// ============================================================================
// Game State Types
// ============================================================================

/** Game phase */
export type GamePhase = 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';

/** The core game state - shared between server and client */
export interface GameState {
  id: string;
  phase: GamePhase;
  config: GameConfig;
  players: Player[];
  pieces: Piece[];
  currentPlayerId: string | null;
  turnNumber: number;
  roundNumber: number;
  roundsSinceElimination: number;
  winnerId: string | null;
  winCondition: 'throne' | 'lastStanding' | null;
}

// ============================================================================
// Move Command Types
// ============================================================================

/** Command sent by a player to make a move */
export interface MoveCommand {
  pieceId: string;
  destination: AxialCoord;
}

// ============================================================================
// Combat Types
// ============================================================================

/** Breakdown of attack/defense calculation */
export interface CombatBreakdown {
  baseStrength: number;
  momentum: number;
  support: number;
  total: number;
}

/** Full combat result - preview of what will happen in an attack */
export interface CombatResult {
  attackerId: string;
  defenderId: string;
  attack: CombatBreakdown;
  defense: CombatBreakdown;
  outcome: 'push' | 'blocked';
  pushDirection: HexDirection | null;
}

/** A valid move option with combat preview if applicable */
export interface ValidMove {
  destination: AxialCoord;
  moveType: 'move' | 'attack';
  hasMomentum: boolean;
  combatPreview: CombatResult | null;
}

// ============================================================================
// Move Result Types
// ============================================================================

/** Result of applying a move */
export interface MoveResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
}

// ============================================================================
// Game Event Types
// ============================================================================

/** Union type of all game events */
export type GameEvent =
  | MoveEvent
  | PushEvent
  | EliminatedEvent
  | TurnEndedEvent
  | GameEndedEvent
  | StarvationTriggeredEvent
  | StarvationResolvedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent;

/** Event: A piece was moved */
export interface MoveEvent {
  type: 'MOVE';
  pieceId: string;
  from: AxialCoord;
  to: AxialCoord;
  hasMomentum: boolean;
}

/** Event: A piece was pushed */
export interface PushEvent {
  type: 'PUSH';
  pieceId: string;
  from: AxialCoord;
  to: AxialCoord;
  pushDirection: HexDirection;
  depth: number; // For staggered animation timing
}

/** Event: A piece was eliminated */
export interface EliminatedEvent {
  type: 'ELIMINATED';
  pieceId: string;
  playerId: string | null;
  position: AxialCoord;
  cause: 'edge' | 'starvation';
}

/** Event: A turn ended */
export interface TurnEndedEvent {
  type: 'TURN_ENDED';
  playerId: string;
  nextPlayerId: string;
  turnNumber: number;
}

/** Event: The game ended */
export interface GameEndedEvent {
  type: 'GAME_ENDED';
  winnerId: string;
  winCondition: 'throne' | 'lastStanding';
}

/** Event: Starvation was triggered */
export interface StarvationTriggeredEvent {
  type: 'STARVATION_TRIGGERED';
  round: number;
  candidates: Map<string, string[]>; // playerId -> pieceIds that can be sacrificed
}

/** Event: Starvation was resolved */
export interface StarvationResolvedEvent {
  type: 'STARVATION_RESOLVED';
  sacrifices: Map<string, string>; // playerId -> sacrificed pieceId
}

/** Event: A player joined the game */
export interface PlayerJoinedEvent {
  type: 'PLAYER_JOINED';
  playerId: string;
  playerName: string;
}

/** Event: A player left the game */
export interface PlayerLeftEvent {
  type: 'PLAYER_LEFT';
  playerId: string;
}

// ============================================================================
// Move Validation Types
// ============================================================================

/** Error codes for invalid moves */
export type MoveValidationError =
  | 'PIECE_NOT_FOUND'
  | 'NOT_YOUR_PIECE'
  | 'NOT_YOUR_TURN'
  | 'GAME_NOT_PLAYING'
  | 'DESTINATION_OFF_BOARD'
  | 'DESTINATION_OCCUPIED_FRIENDLY'
  | 'WARRIOR_CANNOT_ENTER_THRONE'
  | 'INVALID_DISTANCE_WARRIOR'
  | 'INVALID_DISTANCE_JARL'
  | 'JARL_NEEDS_DRAFT_FOR_TWO_HEX'
  | 'PATH_BLOCKED'
  | 'MOVE_NOT_STRAIGHT_LINE'
  | 'SHIELD_CANNOT_MOVE';

/** Result of validating a move */
export interface MoveValidation {
  isValid: boolean;
  error?: MoveValidationError;
  hasMomentum?: boolean; // true if piece moved 2 hexes (grants +1 attack)
  /** When a Jarl's 2-hex move crosses the Throne, this is the adjusted destination */
  adjustedDestination?: AxialCoord;
}

// ============================================================================
// Combat Support Types
// ============================================================================

/** Result of finding inline support for an attacker */
export interface InlineSupportResult {
  /** Array of pieces directly behind the attacker in the support line */
  pieces: Piece[];
  /** Total strength contributed by supporting pieces (sum of individual strengths) */
  totalStrength: number;
}

/** Result of finding bracing support for a defender */
export interface BracingResult {
  /** Array of pieces directly behind the defender in the bracing line */
  pieces: Piece[];
  /** Total strength contributed by bracing pieces (sum of individual strengths) */
  totalStrength: number;
}

// ============================================================================
// Push Resolution Types
// ============================================================================

/** Result of resolving a simple push (defender pushed to empty hex) */
export interface SimplePushResult {
  /** The new game state after the push */
  newState: GameState;
  /** Events generated by the push (MOVE for attacker, PUSH for defender) */
  events: GameEvent[];
}

/** Chain terminator types - what stops a push chain */
export type ChainTerminator = 'edge' | 'shield' | 'throne' | 'empty';

/** Result of detecting a push chain */
export interface ChainResult {
  /** Array of pieces in the chain, ordered from first pushed to last */
  pieces: Piece[];
  /** What terminates the chain */
  terminator: ChainTerminator;
  /** The position where the chain ends (empty hex, edge, shield, or throne) */
  terminatorPosition: AxialCoord;
}

/** Result of resolving an edge push (pieces eliminated at board edge) */
export interface EdgePushResult {
  /** The new game state after the push (with eliminated pieces removed) */
  newState: GameState;
  /** Events generated (MOVE for attacker, PUSH for chain pieces, ELIMINATED for eliminated pieces) */
  events: GameEvent[];
  /** IDs of pieces that were eliminated */
  eliminatedPieceIds: string[];
}

/** Result of resolving a compression push (pieces compress against shield or throne) */
export interface CompressionResult {
  /** The new game state after the compression */
  newState: GameState;
  /** Events generated (MOVE for attacker, PUSH for chain pieces) */
  events: GameEvent[];
}

/** Result of resolving a push using the main resolver */
export interface PushResult {
  /** The new game state after the push */
  newState: GameState;
  /** Events generated by the push (MOVE for attacker, PUSH for chain pieces, ELIMINATED if any) */
  events: GameEvent[];
  /** IDs of pieces that were eliminated (empty if none) */
  eliminatedPieceIds: string[];
}

// ============================================================================
// Victory Condition Types
// ============================================================================

/** Result of checking for throne victory */
export interface ThroneVictoryResult {
  /** Whether a throne victory occurred */
  isVictory: boolean;
  /** The player ID who won (if victory) */
  winnerId: string | null;
}

/** Result of eliminating a player */
export interface EliminatePlayerResult {
  /** The updated game state with the player eliminated */
  newState: GameState;
  /** Array of game events generated by the elimination */
  events: GameEvent[];
  /** Array of piece IDs that were removed (Warriors) */
  removedPieceIds: string[];
}

/** Result of checking for last-standing victory condition */
export interface LastStandingResult {
  /** Whether a last-standing victory occurred */
  isVictory: boolean;
  /** The player ID who won (if victory) */
  winnerId: string | null;
}

/** Type representing the win condition that ended the game */
export type WinCondition = 'throne' | 'lastStanding';

/** Result of checking all win conditions */
export interface WinConditionsResult {
  /** Whether any victory condition was met */
  isVictory: boolean;
  /** The player ID who won (if victory) */
  winnerId: string | null;
  /** The win condition that was met (if victory) */
  condition: WinCondition | null;
}

// ============================================================================
// Reachable Hex Types
// ============================================================================

/** Result of finding reachable hexes for a piece */
export interface ReachableHex {
  /** The destination hex position */
  destination: AxialCoord;
  /** Whether this is a move or attack */
  moveType: 'move' | 'attack';
  /** Whether moving to this hex grants momentum bonus (+1 attack) */
  hasMomentum: boolean;
  /** The direction of movement (useful for attack calculations) */
  direction: HexDirection;
}
