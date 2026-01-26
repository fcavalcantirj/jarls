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

/**
 * Get the opposite direction (180 degrees) of a given hex direction.
 * Opposite directions are 3 apart in the direction array:
 * 0 (East) ↔ 3 (West)
 * 1 (Northeast) ↔ 4 (Southwest)
 * 2 (Northwest) ↔ 5 (Southeast)
 */
export function getOppositeDirection(direction: HexDirection): HexDirection {
  return ((direction + 3) % 6) as HexDirection;
}

/**
 * Round fractional cube coordinates to the nearest valid hex.
 * Uses the constraint q + r + s = 0 to ensure valid coordinates.
 * The component with the largest rounding error is recalculated.
 */
export function cubeRound(q: number, r: number, s: number): CubeCoord {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  // Reset the component with the largest rounding error
  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  // Normalize -0 to 0 to avoid equality issues
  return {
    q: rq === 0 ? 0 : rq,
    r: rr === 0 ? 0 : rr,
    s: rs === 0 ? 0 : rs,
  };
}

/**
 * Linear interpolation between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Draw a line between two hexes, returning all hexes along the path.
 * Uses linear interpolation in cube coordinates with proper rounding.
 * The line includes both the start and end hexes.
 *
 * @param a - Starting hex in cube coordinates
 * @param b - Ending hex in cube coordinates
 * @returns Array of hexes from a to b, inclusive
 */
export function hexLine(a: CubeCoord, b: CubeCoord): CubeCoord[] {
  const distance = hexDistance(a, b);

  // If both hexes are the same, return just that hex
  if (distance === 0) {
    return [{ q: a.q, r: a.r, s: a.s }];
  }

  const results: CubeCoord[] = [];

  // Add a small offset to handle edge cases where the line passes
  // exactly between two hexes (nudges toward consistent rounding)
  const nudge = 1e-6;
  const aq = a.q + nudge;
  const ar = a.r + nudge;
  const as = a.s - 2 * nudge; // Keep constraint: nudge + nudge - 2*nudge = 0

  for (let i = 0; i <= distance; i++) {
    const t = i / distance;
    const q = lerp(aq, b.q, t);
    const r = lerp(ar, b.r, t);
    const s = lerp(as, b.s, t);
    results.push(cubeRound(q, r, s));
  }

  return results;
}

/**
 * Draw a line between two hexes using axial coordinates.
 * Returns all hexes along the path, including start and end.
 */
export function hexLineAxial(a: AxialCoord, b: AxialCoord): AxialCoord[] {
  return hexLine(axialToCube(a), axialToCube(b)).map(cubeToAxial);
}

/**
 * Check if a hex is within the bounds of the game board.
 * A hex is on the board if its distance from the center (0,0,0) is <= radius.
 *
 * @param hex - The hex to check in cube coordinates
 * @param radius - The board radius (e.g., 3 for a 2-player game)
 * @returns true if the hex is within the board bounds
 */
export function isOnBoard(hex: CubeCoord, radius: number): boolean {
  const center: CubeCoord = { q: 0, r: 0, s: 0 };
  return hexDistance(hex, center) <= radius;
}

/**
 * Check if a hex is within the bounds of the game board using axial coordinates.
 *
 * @param hex - The hex to check in axial coordinates
 * @param radius - The board radius
 * @returns true if the hex is within the board bounds
 */
export function isOnBoardAxial(hex: AxialCoord, radius: number): boolean {
  return isOnBoard(axialToCube(hex), radius);
}

/**
 * Check if a hex is on the edge of the game board.
 * A hex is on the edge if its distance from the center equals exactly the radius.
 *
 * @param hex - The hex to check in cube coordinates
 * @param radius - The board radius
 * @returns true if the hex is on the board's edge
 */
export function isOnEdge(hex: CubeCoord, radius: number): boolean {
  const center: CubeCoord = { q: 0, r: 0, s: 0 };
  return hexDistance(hex, center) === radius;
}

/**
 * Check if a hex is on the edge of the game board using axial coordinates.
 *
 * @param hex - The hex to check in axial coordinates
 * @param radius - The board radius
 * @returns true if the hex is on the board's edge
 */
export function isOnEdgeAxial(hex: AxialCoord, radius: number): boolean {
  return isOnEdge(axialToCube(hex), radius);
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
