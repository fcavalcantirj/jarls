// @jarls/shared - Shared types and utilities

export const VERSION = '0.1.0';

// Hexagonal coordinate types
export interface AxialCoord {
  q: number;
  r: number;
}

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

// Hex direction type (0-5 for 6 directions)
// Direction 0 is East, then counter-clockwise: NE, NW, W, SW, SE
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

// Direction vectors in cube coordinates
// Following pointy-top hex orientation with consistent ordering
export const DIRECTIONS: readonly CubeCoord[] = [
  { q: 1, r: 0, s: -1 }, // 0: East
  { q: 1, r: -1, s: 0 }, // 1: Northeast
  { q: 0, r: -1, s: 1 }, // 2: Northwest
  { q: -1, r: 0, s: 1 }, // 3: West
  { q: -1, r: 1, s: 0 }, // 4: Southwest
  { q: 0, r: 1, s: -1 }, // 5: Southeast
] as const;

// Coordinate conversion functions

/**
 * Convert axial coordinates (q, r) to cube coordinates (q, r, s).
 * The s component is derived from the constraint q + r + s = 0.
 */
export function axialToCube(axial: AxialCoord): CubeCoord {
  // Use (0 - q - r) to avoid -0 when q and r are both 0
  const s = 0 - axial.q - axial.r;
  return {
    q: axial.q,
    r: axial.r,
    s: s === 0 ? 0 : s, // Normalize -0 to 0
  };
}

/**
 * Convert cube coordinates (q, r, s) to axial coordinates (q, r).
 * The s component is discarded as it's redundant.
 */
export function cubeToAxial(cube: CubeCoord): AxialCoord {
  return {
    q: cube.q,
    r: cube.r,
  };
}

/**
 * Calculate the distance between two hexes in cube coordinates.
 * The distance is the minimum number of steps to reach from one hex to another.
 * In cube coordinates, the distance is half the Manhattan distance.
 */
export function hexDistance(a: CubeCoord, b: CubeCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Calculate the distance between two hexes in axial coordinates.
 * Converts to cube coordinates internally.
 */
export function hexDistanceAxial(a: AxialCoord, b: AxialCoord): number {
  return hexDistance(axialToCube(a), axialToCube(b));
}

/**
 * Get the neighboring hex in a specific direction.
 * Uses cube coordinates for calculation.
 */
export function getNeighbor(hex: CubeCoord, direction: HexDirection): CubeCoord {
  const dir = DIRECTIONS[direction];
  return {
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: hex.s + dir.s,
  };
}

/**
 * Get all 6 neighboring hexes around a given hex.
 * Returns an array of 6 CubeCoord objects, one for each direction.
 * Index corresponds to HexDirection (0=East, 1=NE, 2=NW, 3=West, 4=SW, 5=SE).
 */
export function getAllNeighbors(hex: CubeCoord): CubeCoord[] {
  return DIRECTIONS.map((dir) => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: hex.s + dir.s,
  }));
}

/**
 * Get the neighboring hex in a specific direction using axial coordinates.
 */
export function getNeighborAxial(hex: AxialCoord, direction: HexDirection): AxialCoord {
  return cubeToAxial(getNeighbor(axialToCube(hex), direction));
}

/**
 * Get all 6 neighboring hexes around a given hex using axial coordinates.
 */
export function getAllNeighborsAxial(hex: AxialCoord): AxialCoord[] {
  return getAllNeighbors(axialToCube(hex)).map(cubeToAxial);
}

// Piece types
export type PieceType = 'jarl' | 'warrior' | 'shield';

export interface Piece {
  id: string;
  type: PieceType;
  playerId: string | null; // null for shields
  position: AxialCoord;
}

// Player types
export interface Player {
  id: string;
  name: string;
  color: string;
  isEliminated: boolean;
}

// Game configuration
export interface GameConfig {
  playerCount: number;
  boardRadius: number;
  shieldCount: number;
  warriorCount: number;
  turnTimerMs: number | null;
}

// Game phase
export type GamePhase = 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';

// Game state - the core shared type
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
