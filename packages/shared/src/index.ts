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

/**
 * Convert a hex coordinate to a unique string key for use as Map keys.
 * Uses axial coordinates for minimal storage.
 *
 * @param hex - The hex coordinate (cube or axial)
 * @returns A unique string key representing the hex position
 */
export function hexToKey(hex: CubeCoord | AxialCoord): string {
  return `${hex.q},${hex.r}`;
}

/**
 * Convert a string key back to an axial coordinate.
 * This is the inverse of hexToKey.
 *
 * @param key - The string key from hexToKey
 * @returns The axial coordinate, or null if the key is invalid
 */
export function keyToHex(key: string): AxialCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) {
    return null;
  }

  const q = parseInt(parts[0], 10);
  const r = parseInt(parts[1], 10);

  if (isNaN(q) || isNaN(r)) {
    return null;
  }

  return { q, r };
}

/**
 * Convert a string key back to a cube coordinate.
 * This is the inverse of hexToKey, returning cube coordinates.
 *
 * @param key - The string key from hexToKey
 * @returns The cube coordinate, or null if the key is invalid
 */
export function keyToHexCube(key: string): CubeCoord | null {
  const axial = keyToHex(key);
  if (axial === null) {
    return null;
  }
  return axialToCube(axial);
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

// Move command - what a player sends to make a move
export interface MoveCommand {
  pieceId: string;
  destination: AxialCoord;
}

// Combat result breakdown for attack/defense calculations
export interface CombatBreakdown {
  baseStrength: number;
  momentum: number;
  support: number;
  total: number;
}

// Combat result - preview of what will happen in an attack
export interface CombatResult {
  attackerId: string;
  defenderId: string;
  attack: CombatBreakdown;
  defense: CombatBreakdown;
  outcome: 'push' | 'blocked';
  pushDirection: HexDirection | null;
}

// Valid move - a possible destination with combat preview if applicable
export interface ValidMove {
  destination: AxialCoord;
  moveType: 'move' | 'attack';
  hasMomentum: boolean;
  combatPreview: CombatResult | null;
}

// Move result - the outcome of applying a move
export interface MoveResult {
  success: boolean;
  error?: string;
  newState: GameState;
  events: GameEvent[];
}

// Game events - things that happen during the game for animation/logging
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

// Individual event types
export interface MoveEvent {
  type: 'MOVE';
  pieceId: string;
  from: AxialCoord;
  to: AxialCoord;
  hasMomentum: boolean;
}

export interface PushEvent {
  type: 'PUSH';
  pieceId: string;
  from: AxialCoord;
  to: AxialCoord;
  pushDirection: HexDirection;
  depth: number; // For staggered animation timing
}

export interface EliminatedEvent {
  type: 'ELIMINATED';
  pieceId: string;
  playerId: string | null;
  position: AxialCoord;
  cause: 'edge' | 'starvation';
}

export interface TurnEndedEvent {
  type: 'TURN_ENDED';
  playerId: string;
  nextPlayerId: string;
  turnNumber: number;
}

export interface GameEndedEvent {
  type: 'GAME_ENDED';
  winnerId: string;
  winCondition: 'throne' | 'lastStanding';
}

export interface StarvationTriggeredEvent {
  type: 'STARVATION_TRIGGERED';
  round: number;
  candidates: Map<string, string[]>; // playerId -> pieceIds that can be sacrificed
}

export interface StarvationResolvedEvent {
  type: 'STARVATION_RESOLVED';
  sacrifices: Map<string, string>; // playerId -> sacrificed pieceId
}

export interface PlayerJoinedEvent {
  type: 'PLAYER_JOINED';
  playerId: string;
  playerName: string;
}

export interface PlayerLeftEvent {
  type: 'PLAYER_LEFT';
  playerId: string;
}

// Board scaling configuration based on player count
// From the ruleset scaling table:
// | Players | Board Radius | Shields | Warriors/Player |
// | 2       | 3            | 5       | 5               |
// | 3       | 5            | 4       | 5               |
// | 4       | 6            | 4       | 4               |
// | 5       | 7            | 3       | 4               |
// | 6       | 8            | 3       | 4               |

interface PlayerScaling {
  boardRadius: number;
  shieldCount: number;
  warriorCount: number;
}

const PLAYER_SCALING: Record<number, PlayerScaling> = {
  2: { boardRadius: 3, shieldCount: 5, warriorCount: 5 },
  3: { boardRadius: 5, shieldCount: 4, warriorCount: 5 },
  4: { boardRadius: 6, shieldCount: 4, warriorCount: 4 },
  5: { boardRadius: 7, shieldCount: 3, warriorCount: 4 },
  6: { boardRadius: 8, shieldCount: 3, warriorCount: 4 },
};

/**
 * Get the game configuration for a given player count.
 * Returns scaling values from the ruleset:
 * - Board radius (hex grid size)
 * - Number of shields (neutral obstacles)
 * - Number of warriors per player
 *
 * @param playerCount - Number of players (2-6)
 * @param turnTimerMs - Optional turn timer in milliseconds (null for no timer)
 * @returns GameConfig object with all configuration values
 * @throws Error if playerCount is outside valid range (2-6)
 */
export function getConfigForPlayerCount(
  playerCount: number,
  turnTimerMs: number | null = null
): GameConfig {
  const scaling = PLAYER_SCALING[playerCount];

  if (!scaling) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  return {
    playerCount,
    boardRadius: scaling.boardRadius,
    shieldCount: scaling.shieldCount,
    warriorCount: scaling.warriorCount,
    turnTimerMs,
  };
}

/**
 * Calculate the total number of hexes on a board with given radius.
 * Formula: 3r² + 3r + 1
 * - Radius 0: 1 hex (center only)
 * - Radius 1: 7 hexes
 * - Radius 2: 19 hexes
 * - Radius 3: 37 hexes (2-player board)
 *
 * @param radius - The board radius (distance from center to edge)
 * @returns The total number of hexes on the board
 */
export function getBoardHexCount(radius: number): number {
  return 3 * radius * radius + 3 * radius + 1;
}

/**
 * Generate all hexes on a board with the given radius.
 * Returns an array of all valid hex positions in cube coordinates.
 * The hexes are returned in a consistent order (by r, then by q).
 *
 * @param radius - The board radius (distance from center to edge)
 * @returns Array of all hex positions on the board
 */
export function generateAllBoardHexes(radius: number): CubeCoord[] {
  const hexes: CubeCoord[] = [];

  // Iterate through all possible q and r values within the bounds
  // For a hex grid with given radius, valid coordinates satisfy:
  // -radius <= q <= radius
  // -radius <= r <= radius
  // -radius <= s <= radius (where s = -q - r)
  for (let q = -radius; q <= radius; q++) {
    // For each q, calculate the valid range of r
    // r must satisfy both: -radius <= r <= radius AND -radius <= -q - r <= radius
    // The second constraint simplifies to: -radius - q <= r <= radius - q
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);

    for (let r = r1; r <= r2; r++) {
      const s = -q - r;
      // Normalize -0 to 0 to avoid equality issues
      hexes.push({
        q: q === 0 ? 0 : q,
        r: r === 0 ? 0 : r,
        s: s === 0 ? 0 : s,
      });
    }
  }

  return hexes;
}

/**
 * Generate all hexes on a board with the given radius in axial coordinates.
 *
 * @param radius - The board radius (distance from center to edge)
 * @returns Array of all hex positions on the board in axial coordinates
 */
export function generateAllBoardHexesAxial(radius: number): AxialCoord[] {
  return generateAllBoardHexes(radius).map(cubeToAxial);
}

/**
 * Convert axial hex coordinates to pixel coordinates for rendering.
 * Uses pointy-top hex orientation.
 * Returns the center point of the hex.
 *
 * @param hex - The hex coordinate
 * @param size - The size of the hex (distance from center to corner)
 * @returns Object with x and y pixel coordinates
 */
export function hexToPixel(hex: AxialCoord, size: number): { x: number; y: number } {
  // Pointy-top orientation
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

/**
 * Calculate the angle (in radians) from the center of the board to a hex.
 * Angle 0 is to the right (East), increasing counter-clockwise.
 *
 * @param hex - The hex coordinate
 * @returns Angle in radians from -π to π
 */
export function hexToAngle(hex: AxialCoord): number {
  const pixel = hexToPixel(hex, 1); // Size doesn't matter for angle calculation
  return Math.atan2(pixel.y, pixel.x);
}

/**
 * Calculate the starting positions for Jarls based on player count.
 * All Jarls start on edge hexes, equidistantly spaced around the board.
 * Since all edge hexes are at the same distance from center (= radius),
 * all Jarls are automatically equidistant from the Throne.
 *
 * For N players, positions are at angles: 0, 2π/N, 4π/N, ..., (N-1)*2π/N
 * For 2 players: directly opposite (0 and π radians = East and West)
 *
 * @param playerCount - Number of players (2-6)
 * @param radius - Board radius
 * @returns Array of starting positions in axial coordinates, one per player
 * @throws Error if playerCount is outside valid range (2-6)
 */
export function calculateStartingPositions(playerCount: number, radius: number): AxialCoord[] {
  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  // Get all edge hexes
  const allHexes = generateAllBoardHexesAxial(radius);
  const edgeHexes = allHexes.filter((hex) => isOnEdgeAxial(hex, radius));

  // Calculate target angles for each player (evenly spaced around the circle)
  // Start at 0 radians (East direction) for player 1
  const targetAngles: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    // Angles go counter-clockwise from East (0 radians)
    targetAngles.push((i * 2 * Math.PI) / playerCount);
  }

  // For each target angle, find the closest edge hex
  const positions: AxialCoord[] = [];
  const usedKeys = new Set<string>();

  for (const targetAngle of targetAngles) {
    let bestHex: AxialCoord | null = null;
    let bestAngleDiff = Infinity;

    for (const hex of edgeHexes) {
      const key = hexToKey(hex);
      if (usedKeys.has(key)) continue; // Don't reuse positions

      const hexAngle = hexToAngle(hex);

      // Calculate angular difference (handle wrap-around)
      let angleDiff = Math.abs(hexAngle - targetAngle);
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }

      if (angleDiff < bestAngleDiff) {
        bestAngleDiff = angleDiff;
        bestHex = hex;
      }
    }

    if (bestHex) {
      positions.push(bestHex);
      usedKeys.add(hexToKey(bestHex));
    }
  }

  return positions;
}

/**
 * Rotate a hex position around the center by a given number of 60-degree steps.
 * Used for generating rotationally symmetric shield positions.
 *
 * @param hex - The hex to rotate (in cube coordinates)
 * @param steps - Number of 60-degree steps to rotate (positive = counter-clockwise)
 * @returns The rotated hex position
 */
export function rotateHex(hex: CubeCoord, steps: number): CubeCoord {
  // Normalize steps to 0-5 range
  steps = ((steps % 6) + 6) % 6;

  let { q, r, s } = hex;

  for (let i = 0; i < steps; i++) {
    // Rotate 60 degrees counter-clockwise: (q, r, s) -> (-r, -s, -q)
    const newQ = -r;
    const newR = -s;
    const newS = -q;
    q = newQ;
    r = newR;
    s = newS;
  }

  // Normalize -0 to 0
  return {
    q: q === 0 ? 0 : q,
    r: r === 0 ? 0 : r,
    s: s === 0 ? 0 : s,
  };
}

/**
 * Generate symmetrical shield positions for the game board.
 * Shields are placed with rotational symmetry based on player count,
 * ensuring fair gameplay where shields are equidistant from all starting positions.
 *
 * Rules:
 * - Shields have N-fold rotational symmetry (where N = playerCount)
 * - No shield on the Throne (center hex at 0,0)
 * - No shield on edge hexes (where pieces start)
 * - Shields are placed in the interior of the board
 *
 * @param playerCount - Number of players (2-6), determines rotational symmetry
 * @param radius - Board radius
 * @param shieldCount - Total number of shields to place
 * @returns Array of shield positions in axial coordinates
 * @throws Error if unable to place the requested number of shields
 */
export function generateSymmetricalShields(
  playerCount: number,
  radius: number,
  shieldCount: number
): AxialCoord[] {
  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  if (shieldCount <= 0) {
    return [];
  }

  // Get all interior hexes (not center, not edge)
  const allHexes = generateAllBoardHexes(radius);
  const center: CubeCoord = { q: 0, r: 0, s: 0 };

  // Filter to interior hexes only (distance > 0 and distance < radius)
  const interiorHexes = allHexes.filter((hex) => {
    const dist = hexDistance(hex, center);
    return dist > 0 && dist < radius;
  });

  // Group hexes by their "canonical" form under rotation
  // This helps us find hexes that can form symmetric groups
  const hexGroups = new Map<string, CubeCoord[]>();

  for (const hex of interiorHexes) {
    // Find all rotations of this hex
    const rotations: CubeCoord[] = [];
    for (let i = 0; i < playerCount; i++) {
      rotations.push(rotateHex(hex, i));
    }

    // Use the lexicographically smallest as the canonical key
    const sortedRotations = rotations
      .map((h) => ({ hex: h, key: `${h.q},${h.r},${h.s}` }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const canonicalKey = sortedRotations[0].key;

    if (!hexGroups.has(canonicalKey)) {
      // Store unique rotations only (some hexes map to themselves under rotation)
      const uniqueRotations: CubeCoord[] = [];
      const seenKeys = new Set<string>();
      for (const rot of rotations) {
        const key = hexToKey(rot);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueRotations.push(rot);
        }
      }
      hexGroups.set(canonicalKey, uniqueRotations);
    }
  }

  // Sort groups by size and distance from center for consistent placement
  // Prefer groups that give us exactly the symmetry we need
  const sortedGroups = Array.from(hexGroups.values()).sort((a, b) => {
    // First, prefer groups with size equal to playerCount (perfect symmetry)
    const aIsPerfect = a.length === playerCount ? 0 : 1;
    const bIsPerfect = b.length === playerCount ? 0 : 1;
    if (aIsPerfect !== bIsPerfect) return aIsPerfect - bIsPerfect;

    // Then sort by group size (descending for efficiency)
    if (a.length !== b.length) return b.length - a.length;

    // Then by distance from center (prefer closer to center)
    const aDist = hexDistance(a[0], center);
    const bDist = hexDistance(b[0], center);
    return aDist - bDist;
  });

  // Select groups to reach the target shield count
  const selectedShields: AxialCoord[] = [];
  const usedKeys = new Set<string>();

  for (const group of sortedGroups) {
    if (selectedShields.length >= shieldCount) break;

    // Check if adding this group would exceed the count
    const remaining = shieldCount - selectedShields.length;

    // Only add the group if all hexes are unused
    const allUnused = group.every((hex) => !usedKeys.has(hexToKey(hex)));
    if (!allUnused) continue;

    // If the group fits exactly or we have room, add it
    if (group.length <= remaining) {
      for (const hex of group) {
        selectedShields.push(cubeToAxial(hex));
        usedKeys.add(hexToKey(hex));
      }
    }
  }

  // If we couldn't place enough shields, try to fill remaining spots
  // with individual hexes (this maintains partial symmetry)
  if (selectedShields.length < shieldCount) {
    // Get remaining interior hexes not yet used
    const remainingHexes = interiorHexes.filter((hex) => !usedKeys.has(hexToKey(hex)));

    // Sort by distance from center (prefer inner hexes)
    remainingHexes.sort((a, b) => hexDistance(a, center) - hexDistance(b, center));

    for (const hex of remainingHexes) {
      if (selectedShields.length >= shieldCount) break;
      selectedShields.push(cubeToAxial(hex));
      usedKeys.add(hexToKey(hex));
    }
  }

  if (selectedShields.length < shieldCount) {
    throw new Error(
      `Unable to place ${shieldCount} shields. Only ${selectedShields.length} positions available.`
    );
  }

  return selectedShields;
}

/**
 * Check if there exists an unobstructed straight-line path from a starting position
 * to the Throne (center hex) that doesn't pass through any shield.
 *
 * A "straight-line path" means the hexes that form a line drawn from the starting
 * position through the center. Uses the hexLine function to get the exact hexes.
 * The path is "unobstructed" if no shields are on any hex along the path.
 *
 * @param startPosition - The starting position (typically a Jarl's starting hex)
 * @param shieldPositions - Set of shield position keys for quick lookup
 * @param radius - Board radius (unused but kept for API consistency)
 * @returns true if the straight-line path to the Throne has no shields
 */
export function hasPathToThrone(
  startPosition: AxialCoord,
  shieldPositions: Set<string>,
  _radius: number
): boolean {
  const throne: AxialCoord = { q: 0, r: 0 };

  // Get all hexes on the straight line from start to throne
  const pathHexes = hexLineAxial(startPosition, throne);

  // Check if any hex on the path (excluding start and end) has a shield
  for (let i = 1; i < pathHexes.length - 1; i++) {
    const hex = pathHexes[i];
    if (shieldPositions.has(hexToKey(hex))) {
      return false; // Shield blocks this path
    }
  }

  return true; // Path is clear
}

/**
 * Validate that a shield placement allows at least one unobstructed straight-line
 * path to the Throne for each player's starting position.
 *
 * This ensures fair gameplay where no player is completely blocked from reaching
 * the Throne by shields.
 *
 * @param shieldPositions - Array of shield positions in axial coordinates
 * @param startingPositions - Array of player starting positions (Jarl positions)
 * @param radius - Board radius
 * @returns Object with isValid boolean and optional error message
 */
export function validateShieldPlacement(
  shieldPositions: AxialCoord[],
  startingPositions: AxialCoord[],
  radius: number
): { isValid: boolean; blockedPlayers: number[] } {
  // Create a Set of shield position keys for O(1) lookup
  const shieldSet = new Set(shieldPositions.map(hexToKey));

  const blockedPlayers: number[] = [];

  // Check each starting position has at least one path to the Throne
  for (let i = 0; i < startingPositions.length; i++) {
    const startPos = startingPositions[i];
    if (!hasPathToThrone(startPos, shieldSet, radius)) {
      blockedPlayers.push(i);
    }
  }

  return {
    isValid: blockedPlayers.length === 0,
    blockedPlayers,
  };
}

/**
 * Find the hex direction that most closely points from a starting position toward the Throne.
 * This is used to determine which direction Warriors should be placed (in front of the Jarl).
 *
 * @param startPosition - The starting position (Jarl's hex)
 * @returns The HexDirection that points most toward the center
 */
export function getDirectionTowardThrone(startPosition: AxialCoord): HexDirection {
  const startCube = axialToCube(startPosition);
  const throne: CubeCoord = { q: 0, r: 0, s: 0 };

  // If at the throne, default to direction 0 (shouldn't happen in practice)
  if (startCube.q === 0 && startCube.r === 0 && startCube.s === 0) {
    return 0;
  }

  // Find the direction that minimizes distance to throne when we move from startPosition
  let bestDirection: HexDirection = 0;
  let bestDistance = Infinity;

  for (let d = 0; d < 6; d++) {
    const neighbor = getNeighbor(startCube, d as HexDirection);
    const dist = hexDistance(neighbor, throne);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestDirection = d as HexDirection;
    }
  }

  return bestDirection;
}

/**
 * Place Warriors in front of the Jarl, between the Jarl and the Throne.
 * Warriors are placed along the straight line from Jarl toward the Throne,
 * starting from the hex adjacent to the Jarl and moving toward the center.
 *
 * Rules:
 * - Warriors placed between Jarl and Throne (not behind the Jarl)
 * - Warriors form a line formation toward the center
 * - Warriors cannot occupy the Throne hex
 * - Warriors cannot occupy hexes with shields
 * - If a hex is blocked, skip to the next available hex toward the center
 *
 * @param jarlPosition - The Jarl's starting position
 * @param warriorCount - Number of Warriors to place
 * @param shieldPositions - Set of shield position keys to avoid
 * @param radius - Board radius (for bounds checking)
 * @returns Array of Warrior positions in axial coordinates
 */
export function placeWarriors(
  jarlPosition: AxialCoord,
  warriorCount: number,
  shieldPositions: Set<string>,
  radius: number
): AxialCoord[] {
  if (warriorCount <= 0) {
    return [];
  }

  const warriors: AxialCoord[] = [];
  const throne: AxialCoord = { q: 0, r: 0 };
  const jarlKey = hexToKey(jarlPosition);
  const throneKey = hexToKey(throne);

  // Get all hexes on the line from Jarl to Throne
  const pathToThrone = hexLineAxial(jarlPosition, throne);

  // Use hexes on the path (excluding Jarl position and Throne)
  // These are the primary placement positions
  const usedKeys = new Set<string>();
  usedKeys.add(jarlKey); // Don't place on Jarl

  for (const hex of pathToThrone) {
    if (warriors.length >= warriorCount) break;

    const key = hexToKey(hex);

    // Skip Jarl position, Throne, shields, and already used positions
    if (key === jarlKey || key === throneKey || shieldPositions.has(key) || usedKeys.has(key)) {
      continue;
    }

    // Skip if off board
    if (!isOnBoardAxial(hex, radius)) {
      continue;
    }

    warriors.push(hex);
    usedKeys.add(key);
  }

  // If we couldn't place all warriors on the direct path (due to shields),
  // try to place remaining warriors on adjacent hexes near the path
  if (warriors.length < warriorCount) {
    // Get the direction toward throne to prioritize "forward" hexes
    const dirToThrone = getDirectionTowardThrone(jarlPosition);

    // Start from Jarl and expand outward looking for available hexes
    const jarlCube = axialToCube(jarlPosition);

    // Check neighbors of the Jarl first, prioritizing the direction toward throne
    const directionPriority = [
      dirToThrone,
      (dirToThrone + 1) % 6,
      (dirToThrone + 5) % 6, // +5 is same as -1 mod 6
      (dirToThrone + 2) % 6,
      (dirToThrone + 4) % 6,
      (dirToThrone + 3) % 6, // Opposite direction last
    ] as HexDirection[];

    // Try adjacent hexes to the Jarl
    for (const dir of directionPriority) {
      if (warriors.length >= warriorCount) break;

      const neighborCube = getNeighbor(jarlCube, dir);
      const neighborAxial = cubeToAxial(neighborCube);
      const key = hexToKey(neighborAxial);

      if (
        !usedKeys.has(key) &&
        !shieldPositions.has(key) &&
        key !== throneKey &&
        isOnBoardAxial(neighborAxial, radius)
      ) {
        warriors.push(neighborAxial);
        usedKeys.add(key);
      }
    }

    // If still not enough, try hexes at distance 2 from Jarl
    if (warriors.length < warriorCount) {
      for (const dir of directionPriority) {
        if (warriors.length >= warriorCount) break;

        const neighbor1 = getNeighbor(jarlCube, dir);
        const neighbor2 = getNeighbor(neighbor1, dir);
        const neighborAxial = cubeToAxial(neighbor2);
        const key = hexToKey(neighborAxial);

        if (
          !usedKeys.has(key) &&
          !shieldPositions.has(key) &&
          key !== throneKey &&
          isOnBoardAxial(neighborAxial, radius)
        ) {
          warriors.push(neighborAxial);
          usedKeys.add(key);
        }
      }
    }
  }

  return warriors;
}
