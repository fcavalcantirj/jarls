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
 * - Shields must not block all paths from starting positions to the Throne
 *
 * @param playerCount - Number of players (2-6), determines rotational symmetry
 * @param radius - Board radius
 * @param shieldCount - Total number of shields to place
 * @param startingPositions - Optional array of starting positions to avoid blocking paths
 * @returns Array of shield positions in axial coordinates
 * @throws Error if unable to place the requested number of shields
 */
export function generateSymmetricalShields(
  playerCount: number,
  radius: number,
  shieldCount: number,
  startingPositions?: AxialCoord[]
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

  // Build set of hexes that are on direct paths from starting positions to throne
  // These should be avoided to ensure valid placements
  const pathHexKeys = new Set<string>();
  if (startingPositions) {
    const throne: AxialCoord = { q: 0, r: 0 };
    for (const startPos of startingPositions) {
      const pathHexes = hexLineAxial(startPos, throne);
      // Add all hexes on the path except start and end
      for (let i = 1; i < pathHexes.length - 1; i++) {
        pathHexKeys.add(hexToKey(pathHexes[i]));
      }
    }
  }

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
  // Also deprioritize groups that would block paths to throne
  const sortedGroups = Array.from(hexGroups.values()).sort((a, b) => {
    // First, check if group blocks paths (deprioritize blocking groups)
    const aBlocksPath = a.some((hex) => pathHexKeys.has(hexToKey(hex)));
    const bBlocksPath = b.some((hex) => pathHexKeys.has(hexToKey(hex)));
    if (aBlocksPath !== bBlocksPath) return aBlocksPath ? 1 : -1;

    // Then, prefer groups with size equal to playerCount (perfect symmetry)
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

    // Sort by: first non-path-blocking, then by distance from center
    remainingHexes.sort((a, b) => {
      const aBlocksPath = pathHexKeys.has(hexToKey(a));
      const bBlocksPath = pathHexKeys.has(hexToKey(b));
      if (aBlocksPath !== bBlocksPath) return aBlocksPath ? 1 : -1;
      return hexDistance(a, center) - hexDistance(b, center);
    });

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

// Default player colors for up to 6 players
const PLAYER_COLORS = [
  '#E53935', // Red
  '#1E88E5', // Blue
  '#43A047', // Green
  '#FB8C00', // Orange
  '#8E24AA', // Purple
  '#00ACC1', // Cyan
];

/**
 * Generate a unique ID for game entities.
 * Uses a simple combination of timestamp and random string.
 *
 * @returns A unique string ID
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create the initial game state for a new game.
 * This includes:
 * - Creating the game with a unique ID
 * - Setting up players with IDs and colors
 * - Placing shields symmetrically on the board
 * - Placing each player's Jarl at their starting position
 * - Placing each player's Warriors in front of their Jarl
 *
 * @param playerNames - Array of player names (2-6 players)
 * @param turnTimerMs - Optional turn timer in milliseconds (null for no timer)
 * @returns Complete GameState ready for the playing phase
 * @throws Error if unable to create valid board
 */
export function createInitialState(
  playerNames: string[],
  turnTimerMs: number | null = null
): GameState {
  const playerCount = playerNames.length;

  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  // Get game configuration for this player count
  const config = getConfigForPlayerCount(playerCount, turnTimerMs);

  // Create players with IDs and colors
  const players: Player[] = playerNames.map((name, index) => ({
    id: generateId(),
    name,
    color: PLAYER_COLORS[index],
    isEliminated: false,
  }));

  // Calculate starting positions for Jarls
  const startingPositions = calculateStartingPositions(playerCount, config.boardRadius);

  // Generate shields with starting positions to avoid blocking direct paths
  const shieldPositions = generateSymmetricalShields(
    playerCount,
    config.boardRadius,
    config.shieldCount,
    startingPositions
  );

  // Validate the placement (should always pass when starting positions are provided)
  const validation = validateShieldPlacement(
    shieldPositions,
    startingPositions,
    config.boardRadius
  );
  if (!validation.isValid) {
    throw new Error(
      `Unable to generate valid shield placement. ` +
        `Some players would have no clear path to the Throne.`
    );
  }

  // Create shield position set for quick lookup
  const shieldSet = new Set(shieldPositions.map(hexToKey));

  // Create all pieces
  const pieces: Piece[] = [];

  // Add shields (no player owner)
  for (const shieldPos of shieldPositions) {
    pieces.push({
      id: generateId(),
      type: 'shield',
      playerId: null,
      position: shieldPos,
    });
  }

  // Add Jarls and Warriors for each player
  for (let i = 0; i < playerCount; i++) {
    const player = players[i];
    const jarlPosition = startingPositions[i];

    // Add Jarl
    pieces.push({
      id: generateId(),
      type: 'jarl',
      playerId: player.id,
      position: jarlPosition,
    });

    // Place Warriors in front of the Jarl
    const warriorPositions = placeWarriors(
      jarlPosition,
      config.warriorCount,
      shieldSet,
      config.boardRadius
    );

    for (const warriorPos of warriorPositions) {
      pieces.push({
        id: generateId(),
        type: 'warrior',
        playerId: player.id,
        position: warriorPos,
      });
    }
  }

  // Create the initial game state
  const gameState: GameState = {
    id: generateId(),
    phase: 'setup',
    config,
    players,
    pieces,
    currentPlayerId: players[0].id, // First player starts
    turnNumber: 0,
    roundNumber: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
  };

  return gameState;
}

/**
 * Get the piece at a specific position on the board.
 * Returns undefined if no piece is at the given position.
 *
 * @param state - The current game state
 * @param position - The position to check (axial coordinates)
 * @returns The piece at the position, or undefined if empty
 */
export function getPieceAt(state: GameState, position: AxialCoord): Piece | undefined {
  const targetKey = hexToKey(position);
  return state.pieces.find((piece) => hexToKey(piece.position) === targetKey);
}

/**
 * Get a piece by its unique ID.
 * Returns undefined if no piece with the given ID exists.
 *
 * @param state - The current game state
 * @param pieceId - The unique ID of the piece to find
 * @returns The piece with the given ID, or undefined if not found
 */
export function getPieceById(state: GameState, pieceId: string): Piece | undefined {
  return state.pieces.find((piece) => piece.id === pieceId);
}

/**
 * Check if a path between two hexes is clear of pieces.
 * A path is clear if no pieces exist on any hex between the start and end (exclusive).
 * The start and end hexes themselves are not checked.
 *
 * This is used to validate moves - pieces cannot move through other pieces.
 *
 * @param state - The current game state
 * @param start - Starting hex position (exclusive - not checked for pieces)
 * @param end - Ending hex position (exclusive - not checked for pieces)
 * @returns true if all hexes between start and end are empty, false if any are occupied
 */
export function isPathClear(state: GameState, start: AxialCoord, end: AxialCoord): boolean {
  // Get all hexes along the line from start to end
  const pathHexes = hexLineAxial(start, end);

  // Check each hex between start and end (exclusive of both endpoints)
  // pathHexes[0] is start, pathHexes[pathHexes.length - 1] is end
  for (let i = 1; i < pathHexes.length - 1; i++) {
    const hex = pathHexes[i];
    if (getPieceAt(state, hex) !== undefined) {
      return false; // Piece blocks the path
    }
  }

  return true; // Path is clear
}

/**
 * Check if a Jarl has a draft formation in a specific direction.
 * A draft formation exists when there are 2 or more friendly Warriors
 * behind the Jarl in a straight line (in the opposite direction of movement).
 *
 * The Warriors don't need to be consecutive - gaps are allowed.
 * The direction parameter represents the intended movement direction,
 * so we check for Warriors in the opposite direction (behind the Jarl).
 *
 * @param state - The current game state
 * @param jarlPosition - The Jarl's current position
 * @param playerId - The player ID who owns the Jarl
 * @param movementDirection - The direction the Jarl intends to move
 * @returns true if there are 2+ friendly Warriors behind the Jarl in the opposite direction
 */
export function hasDraftFormationInDirection(
  state: GameState,
  jarlPosition: AxialCoord,
  playerId: string,
  movementDirection: HexDirection
): boolean {
  const oppositeDirection = getOppositeDirection(movementDirection);
  const jarlCube = axialToCube(jarlPosition);

  // Count friendly Warriors in a straight line behind the Jarl
  let warriorCount = 0;
  let currentHex = jarlCube;

  // Walk backwards from the Jarl in the opposite direction
  // Keep going until we're off the board or have counted enough
  const radius = state.config.boardRadius;

  while (warriorCount < 2) {
    // Move to the next hex in the opposite direction
    currentHex = getNeighbor(currentHex, oppositeDirection);

    // Stop if we've gone off the board
    if (!isOnBoard(currentHex, radius)) {
      break;
    }

    // Check what's at this hex
    const piece = getPieceAt(state, cubeToAxial(currentHex));

    if (piece === undefined) {
      // Empty hex - continue looking (gaps are allowed)
      continue;
    }

    if (piece.type === 'warrior' && piece.playerId === playerId) {
      // Friendly Warrior - count it
      warriorCount++;
    } else {
      // Non-friendly piece or non-Warrior - stop searching
      // Enemy pieces or shields block the draft line
      break;
    }
  }

  return warriorCount >= 2;
}

/**
 * Check if a Jarl has a draft formation that enables 2-hex movement.
 * This checks all 6 directions to see if any direction has 2+ Warriors behind.
 *
 * Returns the directions in which the Jarl can make a draft move (2-hex move).
 * If the returned array is empty, the Jarl can only move 1 hex.
 *
 * Rules:
 * - A draft formation requires 2 or more friendly Warriors directly behind the Jarl
 * - "Behind" means in the opposite direction of the intended movement
 * - Warriors don't need to be consecutive (gaps are allowed)
 * - Enemy pieces or shields block the draft line
 *
 * @param state - The current game state
 * @param jarlPosition - The Jarl's current position
 * @param playerId - The player ID who owns the Jarl
 * @returns Array of HexDirection values where draft movement is possible
 */
export function hasDraftFormation(
  state: GameState,
  jarlPosition: AxialCoord,
  playerId: string
): HexDirection[] {
  const draftDirections: HexDirection[] = [];

  for (let d = 0; d < 6; d++) {
    const direction = d as HexDirection;
    if (hasDraftFormationInDirection(state, jarlPosition, playerId, direction)) {
      draftDirections.push(direction);
    }
  }

  return draftDirections;
}

/**
 * Error type returned when a move is invalid.
 */
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

/**
 * Result of validating a move.
 */
export interface MoveValidation {
  isValid: boolean;
  error?: MoveValidationError;
  hasMomentum?: boolean; // true if piece moved 2 hexes (grants +1 attack)
}

/**
 * Get the direction from one hex to an adjacent hex.
 * Returns the HexDirection if the hexes are adjacent, null if not adjacent.
 *
 * @param from - Starting hex position
 * @param to - Target hex position (must be adjacent)
 * @returns The HexDirection from 'from' to 'to', or null if not adjacent
 */
export function getDirectionBetweenAdjacent(from: AxialCoord, to: AxialCoord): HexDirection | null {
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  // Check each direction to find a match
  for (let d = 0; d < 6; d++) {
    const dir = DIRECTIONS[d];
    if (dir.q === dq && dir.r === dr) {
      return d as HexDirection;
    }
  }

  return null; // Not adjacent
}

/**
 * Check if two hexes are in a straight line on the hex grid.
 * Returns the direction from 'from' to 'to' if they are in a line, null otherwise.
 *
 * Two hexes are in a straight line if and only if one of the following is true:
 * - They are the same hex (distance 0)
 * - The line between them follows one of the 6 hex directions
 *
 * In cube coordinates, a straight line means one of q, r, or s is constant
 * while the other two change by equal and opposite amounts.
 *
 * @param from - Starting hex position
 * @param to - Target hex position
 * @returns The HexDirection from 'from' to 'to' if in a straight line, null otherwise
 */
export function getLineDirection(from: AxialCoord, to: AxialCoord): HexDirection | null {
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  // Same position
  if (dq === 0 && dr === 0) {
    return null; // No direction for same position
  }

  // In hex coordinates (axial), a straight line has one of these properties:
  // 1. dq = 0 (moving along r-axis)
  // 2. dr = 0 (moving along q-axis)
  // 3. dq = -dr (moving along the s-axis, where s = -q - r)

  if (dq === 0) {
    // Moving along r-axis
    // dr > 0: Southeast (direction 5) or dr < 0: Northwest (direction 2)
    return dr > 0 ? 5 : 2;
  }

  if (dr === 0) {
    // Moving along q-axis
    // dq > 0: East (direction 0) or dq < 0: West (direction 3)
    return dq > 0 ? 0 : 3;
  }

  if (dq === -dr) {
    // Moving along s-axis (diagonal)
    // dq > 0, dr < 0: Northeast (direction 1)
    // dq < 0, dr > 0: Southwest (direction 4)
    return dq > 0 ? 1 : 4;
  }

  // Not in a straight line
  return null;
}

/**
 * Validate a move command according to all game rules.
 * This is the main move validation function that checks:
 * 1. Piece exists and belongs to the player
 * 2. It's the player's turn
 * 3. Game is in 'playing' phase
 * 4. Destination is valid for the piece type (distance and direction)
 * 5. Path is clear (no pieces blocking)
 * 6. Jarl draft requirement for 2-hex moves
 * 7. Warriors cannot enter the Throne
 * 8. Cannot land on friendly pieces
 *
 * @param state - The current game state
 * @param playerId - The ID of the player making the move
 * @param command - The move command (pieceId and destination)
 * @returns MoveValidation object with isValid and optional error
 */
export function validateMove(
  state: GameState,
  playerId: string,
  command: MoveCommand
): MoveValidation {
  const { pieceId, destination } = command;

  // 1. Check game phase
  if (state.phase !== 'playing') {
    return { isValid: false, error: 'GAME_NOT_PLAYING' };
  }

  // 2. Check it's the player's turn
  if (state.currentPlayerId !== playerId) {
    return { isValid: false, error: 'NOT_YOUR_TURN' };
  }

  // 3. Check piece exists
  const piece = getPieceById(state, pieceId);
  if (!piece) {
    return { isValid: false, error: 'PIECE_NOT_FOUND' };
  }

  // 4. Check piece belongs to player
  if (piece.playerId !== playerId) {
    return { isValid: false, error: 'NOT_YOUR_PIECE' };
  }

  // 5. Check piece type - shields cannot move
  if (piece.type === 'shield') {
    return { isValid: false, error: 'SHIELD_CANNOT_MOVE' };
  }

  // 6. Check destination is on the board
  if (!isOnBoardAxial(destination, state.config.boardRadius)) {
    return { isValid: false, error: 'DESTINATION_OFF_BOARD' };
  }

  // 7. Check destination is not occupied by a friendly piece
  const pieceAtDestination = getPieceAt(state, destination);
  if (pieceAtDestination && pieceAtDestination.playerId === playerId) {
    return { isValid: false, error: 'DESTINATION_OCCUPIED_FRIENDLY' };
  }

  // 8. Warriors cannot enter the Throne (center hex at 0,0)
  if (piece.type === 'warrior' && destination.q === 0 && destination.r === 0) {
    return { isValid: false, error: 'WARRIOR_CANNOT_ENTER_THRONE' };
  }

  // 9. Check movement is in a straight line
  const direction = getLineDirection(piece.position, destination);
  if (direction === null) {
    return { isValid: false, error: 'MOVE_NOT_STRAIGHT_LINE' };
  }

  // 10. Calculate distance
  const distance = hexDistanceAxial(piece.position, destination);

  // 11. Validate distance based on piece type
  if (piece.type === 'warrior') {
    // Warriors can move 1 or 2 hexes
    if (distance < 1 || distance > 2) {
      return { isValid: false, error: 'INVALID_DISTANCE_WARRIOR' };
    }
  } else if (piece.type === 'jarl') {
    // Jarl can move 1 hex normally, or 2 hexes with draft formation
    if (distance < 1 || distance > 2) {
      return { isValid: false, error: 'INVALID_DISTANCE_JARL' };
    }

    // For 2-hex move, Jarl needs draft formation
    if (distance === 2) {
      if (!hasDraftFormationInDirection(state, piece.position, playerId, direction)) {
        return { isValid: false, error: 'JARL_NEEDS_DRAFT_FOR_TWO_HEX' };
      }
    }
  }

  // 12. Check path is clear (no pieces blocking between start and destination)
  if (!isPathClear(state, piece.position, destination)) {
    return { isValid: false, error: 'PATH_BLOCKED' };
  }

  // Move is valid
  const hasMomentum = distance === 2;
  return { isValid: true, hasMomentum };
}

/**
 * Result of finding inline support for an attacker.
 */
export interface InlineSupportResult {
  /** Array of pieces directly behind the attacker in the support line */
  pieces: Piece[];
  /** Total strength contributed by supporting pieces (sum of individual strengths) */
  totalStrength: number;
}

/**
 * Get the base strength of a piece based on its type.
 * Warriors have strength 1, Jarls have strength 2.
 *
 * @param piece - The piece to get strength for
 * @returns The piece's base strength (1 for Warrior, 2 for Jarl, 0 for Shield)
 */
export function getPieceStrength(piece: Piece): number {
  switch (piece.type) {
    case 'jarl':
      return 2;
    case 'warrior':
      return 1;
    case 'shield':
      return 0;
  }
}

/**
 * Find all pieces providing inline support for an attacker.
 * Inline support comes from friendly pieces directly behind the attacker
 * in a straight line opposite to the attack direction.
 *
 * Rules:
 * - Support pieces must be friendly (same playerId as attacker)
 * - Support pieces must be in a continuous line behind the attacker
 * - The line stops at the first empty hex or enemy piece
 * - Each supporting piece adds its strength (Warrior: 1, Jarl: 2)
 *
 * @param state - The current game state
 * @param attackerPosition - The position where the attacker will be when attacking
 *                           (typically the hex adjacent to the defender)
 * @param attackerId - The player ID of the attacker (for determining friendly pieces)
 * @param attackDirection - The direction of the attack (toward the defender)
 * @returns InlineSupportResult with supporting pieces and total strength
 */
export function findInlineSupport(
  state: GameState,
  attackerPosition: AxialCoord,
  attackerId: string,
  attackDirection: HexDirection
): InlineSupportResult {
  const supportPieces: Piece[] = [];
  let totalStrength = 0;

  // Support comes from behind, which is the opposite direction of the attack
  const supportDirection = getOppositeDirection(attackDirection);
  const radius = state.config.boardRadius;

  // Start from the position directly behind the attacker
  let currentHex = axialToCube(attackerPosition);

  // Walk backwards from the attacker, collecting supporting pieces
  while (true) {
    // Move to the next hex in the support direction (behind the attacker)
    currentHex = getNeighbor(currentHex, supportDirection);

    // Stop if we've gone off the board
    if (!isOnBoard(currentHex, radius)) {
      break;
    }

    // Check what's at this hex
    const piece = getPieceAt(state, cubeToAxial(currentHex));

    if (piece === undefined) {
      // Empty hex - stop collecting support
      // Support line must be continuous (no gaps allowed for support)
      break;
    }

    if (piece.playerId === attackerId) {
      // Friendly piece - adds to support
      supportPieces.push(piece);
      totalStrength += getPieceStrength(piece);
    } else {
      // Enemy piece or shield - stops the support line
      break;
    }
  }

  return { pieces: supportPieces, totalStrength };
}

/**
 * Result of finding bracing support for a defender.
 */
export interface BracingResult {
  /** Array of pieces directly behind the defender in the bracing line */
  pieces: Piece[];
  /** Total strength contributed by bracing pieces (sum of individual strengths) */
  totalStrength: number;
}

/**
 * Find all pieces providing bracing support for a defender.
 * Bracing comes from friendly pieces directly behind the defender
 * in the direction they would be pushed (same as the attack direction).
 *
 * Rules:
 * - Bracing pieces must be friendly (same playerId as defender)
 * - Bracing pieces must be in a continuous line behind the defender
 * - The line stops at the first empty hex or enemy piece
 * - Each bracing piece adds its strength (Warrior: 1, Jarl: 2)
 *
 * @param state - The current game state
 * @param defenderPosition - The position of the defender
 * @param defenderId - The player ID of the defender (for determining friendly pieces)
 * @param pushDirection - The direction the defender would be pushed (same as attack direction)
 * @returns BracingResult with bracing pieces and total strength
 */
export function findBracing(
  state: GameState,
  defenderPosition: AxialCoord,
  defenderId: string,
  pushDirection: HexDirection
): BracingResult {
  const bracingPieces: Piece[] = [];
  let totalStrength = 0;

  // Bracing comes from behind the defender in the push direction
  // (the pieces that would resist the push)
  const radius = state.config.boardRadius;

  // Start from the position directly behind the defender (in push direction)
  let currentHex = axialToCube(defenderPosition);

  // Walk in the push direction from the defender, collecting bracing pieces
  while (true) {
    // Move to the next hex in the push direction (behind the defender)
    currentHex = getNeighbor(currentHex, pushDirection);

    // Stop if we've gone off the board
    if (!isOnBoard(currentHex, radius)) {
      break;
    }

    // Check what's at this hex
    const piece = getPieceAt(state, cubeToAxial(currentHex));

    if (piece === undefined) {
      // Empty hex - stop collecting bracing
      // Bracing line must be continuous (no gaps allowed)
      break;
    }

    if (piece.playerId === defenderId) {
      // Friendly piece - adds to bracing
      bracingPieces.push(piece);
      totalStrength += getPieceStrength(piece);
    } else {
      // Enemy piece or shield - stops the bracing line
      break;
    }
  }

  return { pieces: bracingPieces, totalStrength };
}

/**
 * Calculate the total attack power for a piece attacking another.
 *
 * Attack = Base Strength + Momentum + Inline Support
 *
 * Where:
 * - Base Strength: 1 for Warrior, 2 for Jarl
 * - Momentum: +1 if the attacker moved 2 hexes to reach the defender
 * - Inline Support: Sum of strength of all friendly pieces directly behind the attacker
 *
 * @param state - The current game state
 * @param attacker - The attacking piece
 * @param attackerPosition - The position where the attacker will be when attacking
 *                           (the hex adjacent to the defender, NOT the attacker's current position)
 * @param attackDirection - The direction of the attack (toward the defender)
 * @param hasMomentum - Whether the attacker moved 2 hexes (grants +1 attack)
 * @returns CombatBreakdown with base strength, momentum, support, and total
 */
export function calculateAttack(
  state: GameState,
  attacker: Piece,
  attackerPosition: AxialCoord,
  attackDirection: HexDirection,
  hasMomentum: boolean
): CombatBreakdown {
  // Base strength depends on piece type
  const baseStrength = getPieceStrength(attacker);

  // Momentum bonus: +1 if moved 2 hexes
  const momentum = hasMomentum ? 1 : 0;

  // Inline support: sum of strength of friendly pieces directly behind
  const supportResult = findInlineSupport(
    state,
    attackerPosition,
    attacker.playerId!,
    attackDirection
  );
  const support = supportResult.totalStrength;

  // Total attack power
  const total = baseStrength + momentum + support;

  return {
    baseStrength,
    momentum,
    support,
    total,
  };
}

/**
 * Calculate the defense power of a defender.
 * Defense = Base Strength + Bracing (friendly pieces behind defender in push direction)
 *
 * @param state - The current game state
 * @param defender - The defending piece
 * @param defenderPosition - The position of the defender
 * @param pushDirection - The direction the defender would be pushed (same as attack direction)
 * @returns CombatBreakdown with base strength, momentum (always 0 for defense), support (bracing), and total
 */
export function calculateDefense(
  state: GameState,
  defender: Piece,
  defenderPosition: AxialCoord,
  pushDirection: HexDirection
): CombatBreakdown {
  // Base strength depends on piece type
  const baseStrength = getPieceStrength(defender);

  // Defenders don't get momentum (that's an attacker bonus)
  const momentum = 0;

  // Bracing: sum of strength of friendly pieces directly behind (in push direction)
  const bracingResult = findBracing(state, defenderPosition, defender.playerId!, pushDirection);
  const support = bracingResult.totalStrength;

  // Total defense power
  const total = baseStrength + momentum + support;

  return {
    baseStrength,
    momentum,
    support,
    total,
  };
}

/**
 * Calculate the full combat result between an attacker and defender.
 * This function provides a complete combat preview including:
 * - Attack and defense power breakdowns
 * - Combat outcome (push or blocked)
 * - Push direction if the attack succeeds
 *
 * Combat outcome rules:
 * - Attack > Defense: Push succeeds, defender is pushed in the attack direction
 * - Attack <= Defense: Attack is blocked, no pieces move
 *
 * @param state - The current game state
 * @param attacker - The attacking piece
 * @param attackerPosition - The position where the attacker will be when attacking
 *                           (the hex adjacent to the defender)
 * @param defender - The defending piece
 * @param defenderPosition - The position of the defender
 * @param attackDirection - The direction of the attack (toward the defender)
 * @param hasMomentum - Whether the attacker moved 2 hexes (grants +1 attack)
 * @returns CombatResult with full attack/defense breakdowns, outcome, and push direction
 */
export function calculateCombat(
  state: GameState,
  attacker: Piece,
  attackerPosition: AxialCoord,
  defender: Piece,
  defenderPosition: AxialCoord,
  attackDirection: HexDirection,
  hasMomentum: boolean
): CombatResult {
  // Calculate attack power
  const attack = calculateAttack(state, attacker, attackerPosition, attackDirection, hasMomentum);

  // Calculate defense power (push direction is same as attack direction)
  const defense = calculateDefense(state, defender, defenderPosition, attackDirection);

  // Determine outcome: Attack must be GREATER than defense to succeed
  const outcome: 'push' | 'blocked' = attack.total > defense.total ? 'push' : 'blocked';

  // Push direction is the attack direction if push succeeds, null if blocked
  const pushDirection: HexDirection | null = outcome === 'push' ? attackDirection : null;

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    attack,
    defense,
    outcome,
    pushDirection,
  };
}

/**
 * Result of resolving a simple push (defender pushed to empty hex).
 */
export interface SimplePushResult {
  /** The new game state after the push */
  newState: GameState;
  /** Events generated by the push (MOVE for attacker, PUSH for defender) */
  events: GameEvent[];
}

/**
 * Resolve a simple push where the defender is pushed to an empty hex.
 * This is used when a push succeeds and the chain terminates at an empty hex.
 *
 * The resolution:
 * 1. Defender moves one hex in the push direction
 * 2. Attacker takes the defender's original position
 *
 * @param state - The current game state
 * @param attackerId - The ID of the attacking piece
 * @param attackerFrom - The attacker's original position (before moving to attack)
 * @param defenderPosition - The defender's current position (where attacker will end up)
 * @param pushDirection - The direction of the push
 * @param hasMomentum - Whether the attacker moved 2 hexes (for MOVE event)
 * @returns SimplePushResult with new state and generated events
 */
export function resolveSimplePush(
  state: GameState,
  attackerId: string,
  attackerFrom: AxialCoord,
  defenderPosition: AxialCoord,
  pushDirection: HexDirection,
  hasMomentum: boolean
): SimplePushResult {
  const events: GameEvent[] = [];

  // Get the pieces
  const attacker = getPieceById(state, attackerId);
  const defender = getPieceAt(state, defenderPosition);

  if (!attacker) {
    throw new Error(`Attacker with ID ${attackerId} not found`);
  }
  if (!defender) {
    throw new Error(`No defender at position (${defenderPosition.q}, ${defenderPosition.r})`);
  }

  // Calculate defender's new position (one hex in push direction)
  const defenderNewPosition = getNeighborAxial(defenderPosition, pushDirection);

  // Create a copy of the pieces array with updated positions
  const newPieces = state.pieces.map((piece) => {
    if (piece.id === attacker.id) {
      // Attacker moves to defender's original position
      return { ...piece, position: defenderPosition };
    }
    if (piece.id === defender.id) {
      // Defender moves to new position
      return { ...piece, position: defenderNewPosition };
    }
    return piece;
  });

  // Create the new state
  const newState: GameState = {
    ...state,
    pieces: newPieces,
  };

  // Generate MOVE event for attacker
  const moveEvent: MoveEvent = {
    type: 'MOVE',
    pieceId: attacker.id,
    from: attackerFrom,
    to: defenderPosition,
    hasMomentum,
  };
  events.push(moveEvent);

  // Generate PUSH event for defender
  const pushEvent: PushEvent = {
    type: 'PUSH',
    pieceId: defender.id,
    from: defenderPosition,
    to: defenderNewPosition,
    pushDirection,
    depth: 0, // First piece in chain has depth 0
  };
  events.push(pushEvent);

  return { newState, events };
}

// Chain terminator types
export type ChainTerminator = 'edge' | 'shield' | 'throne' | 'empty';

// Result of detecting a push chain
export interface ChainResult {
  /** Array of pieces in the chain, ordered from first pushed to last */
  pieces: Piece[];
  /** What terminates the chain */
  terminator: ChainTerminator;
  /** The position where the chain ends (empty hex, edge, shield, or throne) */
  terminatorPosition: AxialCoord;
}

/**
 * Detect all pieces in a push chain starting from a defender.
 *
 * When a push succeeds, the defender moves in the push direction. If there's
 * another piece behind the defender, it also gets pushed, creating a chain.
 * This continues until the chain hits:
 * - An empty hex (pieces compress into it)
 * - The board edge (piece at end is eliminated)
 * - A shield (pieces compress against it)
 * - The throne (pieces compress against it)
 *
 * The chain includes pieces of any allegiance - friendly and enemy pieces
 * alike get pushed in the chain.
 *
 * @param state - The current game state
 * @param startPosition - The position of the first piece being pushed (the defender)
 * @param pushDirection - The direction pieces are being pushed
 * @returns ChainResult with pieces in the chain and what terminates it
 */
export function detectChain(
  state: GameState,
  startPosition: AxialCoord,
  pushDirection: HexDirection
): ChainResult {
  const pieces: Piece[] = [];
  let currentPos = startPosition;

  // Walk in the push direction, collecting pieces until we hit a terminator
  while (true) {
    const pieceAtCurrent = getPieceAt(state, currentPos);

    // If there's a piece at the current position, check what type it is
    if (pieceAtCurrent) {
      // Shields don't move - they terminate the chain
      if (pieceAtCurrent.type === 'shield') {
        return {
          pieces,
          terminator: 'shield',
          terminatorPosition: currentPos,
        };
      }

      // This piece is part of the chain (jarl or warrior)
      pieces.push(pieceAtCurrent);
    } else {
      // Empty hex - chain ends here
      return {
        pieces,
        terminator: 'empty',
        terminatorPosition: currentPos,
      };
    }

    // Move to the next position in the push direction
    const nextPos = getNeighborAxial(currentPos, pushDirection);

    // Check if next position is off the board (edge)
    if (!isOnBoardAxial(nextPos, state.config.boardRadius)) {
      return {
        pieces,
        terminator: 'edge',
        terminatorPosition: nextPos, // Position beyond the edge
      };
    }

    // Check if next position is the throne (center)
    if (nextPos.q === 0 && nextPos.r === 0) {
      // Check if there's already a piece on the throne
      const pieceOnThrone = getPieceAt(state, nextPos);
      if (!pieceOnThrone) {
        // Empty throne - chain ends here (throne acts as terminator for non-Jarl pieces,
        // but we report it as 'throne' so resolution can handle it appropriately)
        return {
          pieces,
          terminator: 'throne',
          terminatorPosition: nextPos,
        };
      }
      // If there's a piece on the throne, it becomes part of the chain
      // and we continue checking what's beyond
    }

    currentPos = nextPos;
  }
}

/**
 * Result of resolving an edge push (pieces eliminated at board edge).
 */
export interface EdgePushResult {
  /** The new game state after the push (with eliminated pieces removed) */
  newState: GameState;
  /** Events generated (MOVE for attacker, PUSH for chain pieces, ELIMINATED for eliminated pieces) */
  events: GameEvent[];
  /** IDs of pieces that were eliminated */
  eliminatedPieceIds: string[];
}

/**
 * Resolve a push where the chain terminates at the board edge.
 * Pieces at the edge are eliminated (pushed off the board).
 * The chain compresses toward the edge, with pieces filling in positions
 * from those that were eliminated.
 *
 * Example: If pieces A, B, C are in a chain being pushed toward the edge,
 * and C is at the edge, then C is eliminated, B moves to C's position,
 * A moves to B's position, and the attacker takes A's original position.
 *
 * @param state - The current game state
 * @param attackerId - The ID of the attacking piece
 * @param attackerFrom - The attacker's original position (before moving to attack)
 * @param defenderPosition - The defender's current position (first piece in chain)
 * @param pushDirection - The direction of the push
 * @param hasMomentum - Whether the attacker moved 2 hexes (for MOVE event)
 * @param chain - The detected chain result from detectChain
 * @returns EdgePushResult with new state, events, and eliminated piece IDs
 */
export function resolveEdgePush(
  state: GameState,
  attackerId: string,
  attackerFrom: AxialCoord,
  defenderPosition: AxialCoord,
  pushDirection: HexDirection,
  hasMomentum: boolean,
  chain: ChainResult
): EdgePushResult {
  const events: GameEvent[] = [];
  const eliminatedPieceIds: string[] = [];

  // Get the attacker
  const attacker = getPieceById(state, attackerId);
  if (!attacker) {
    throw new Error(`Attacker with ID ${attackerId} not found`);
  }

  // Validate chain terminator is edge
  if (chain.terminator !== 'edge') {
    throw new Error(`resolveEdgePush called with non-edge terminator: ${chain.terminator}`);
  }

  // The chain pieces are ordered from first pushed (closest to attacker) to last (closest to edge)
  // When pushed to an edge, the last piece(s) get eliminated
  // We need to figure out how many pieces get eliminated based on the chain length
  // and available space

  // All pieces in the chain will move one position in the push direction
  // The piece at the end (closest to edge) gets pushed off and eliminated
  // If there's only one piece, it's eliminated and attacker takes its position

  // Build a list of positions in the chain, from defender position toward edge
  const chainPositions: AxialCoord[] = [];
  let pos = defenderPosition;
  for (let i = 0; i < chain.pieces.length; i++) {
    chainPositions.push(pos);
    if (i < chain.pieces.length - 1) {
      pos = getNeighborAxial(pos, pushDirection);
    }
  }

  // The last piece in the chain is at the edge and will be eliminated
  const lastPiece = chain.pieces[chain.pieces.length - 1];
  const lastPosition = chainPositions[chainPositions.length - 1];

  // Create eliminated event for the last piece
  const eliminatedEvent: EliminatedEvent = {
    type: 'ELIMINATED',
    pieceId: lastPiece.id,
    playerId: lastPiece.playerId,
    position: lastPosition,
    cause: 'edge',
  };
  events.push(eliminatedEvent);
  eliminatedPieceIds.push(lastPiece.id);

  // Create a set of piece IDs to remove (eliminated pieces)
  const piecesToRemove = new Set(eliminatedPieceIds);

  // Build the new positions for surviving pieces
  // Each surviving piece moves to the position of the piece ahead of it in the chain
  const newPositions = new Map<string, AxialCoord>();

  // For pieces in the chain (except the eliminated one), they shift toward the edge
  for (let i = 0; i < chain.pieces.length - 1; i++) {
    const piece = chain.pieces[i];
    // This piece moves to the position of the next piece in the chain
    const newPos = chainPositions[i + 1];
    newPositions.set(piece.id, newPos);

    // Create PUSH event for this piece
    const pushEvent: PushEvent = {
      type: 'PUSH',
      pieceId: piece.id,
      from: chainPositions[i],
      to: newPos,
      pushDirection,
      depth: i, // Depth for staggered animation
    };
    events.push(pushEvent);
  }

  // The attacker moves to the defender's original position (first in chain)
  newPositions.set(attacker.id, defenderPosition);

  // Create MOVE event for attacker (should be first in the events array for proper ordering)
  const moveEvent: MoveEvent = {
    type: 'MOVE',
    pieceId: attacker.id,
    from: attackerFrom,
    to: defenderPosition,
    hasMomentum,
  };
  // Insert at beginning so MOVE comes before PUSH events
  events.unshift(moveEvent);

  // Create the new pieces array
  const newPieces = state.pieces
    .filter((piece) => !piecesToRemove.has(piece.id))
    .map((piece) => {
      const newPos = newPositions.get(piece.id);
      if (newPos) {
        return { ...piece, position: newPos };
      }
      return piece;
    });

  // Create the new state
  const newState: GameState = {
    ...state,
    pieces: newPieces,
  };

  return { newState, events, eliminatedPieceIds };
}

/**
 * Result of resolving a compression push (pieces compress against shield or throne).
 */
export interface CompressionResult {
  /** The new game state after the compression */
  newState: GameState;
  /** Events generated (MOVE for attacker, PUSH for chain pieces) */
  events: GameEvent[];
}

/**
 * Resolve a push where the chain compresses against a blocker (shield or throne).
 * Unlike edge pushes, compression does not eliminate any pieces - they simply
 * compress against the immovable blocker.
 *
 * The resolution:
 * 1. Chain pieces don't actually move (they're already adjacent to the blocker)
 * 2. Attacker takes the first defender's position
 * 3. No pieces are eliminated
 *
 * This handles:
 * - Shield blocking: pieces compress against an immovable shield
 * - Throne blocking: Warriors compress against throne (they can't enter)
 *                    Jarls also compress against throne when pushed (can't be pushed onto it)
 *
 * @param state - The current game state
 * @param attackerId - The ID of the attacking piece
 * @param attackerFrom - The attacker's original position (before moving to attack)
 * @param defenderPosition - The defender's current position (first piece in chain)
 * @param pushDirection - The direction of the push
 * @param hasMomentum - Whether the attacker moved 2 hexes (for MOVE event)
 * @param chain - The detected chain result from detectChain
 * @returns CompressionResult with new state and events
 */
export function resolveCompression(
  state: GameState,
  attackerId: string,
  attackerFrom: AxialCoord,
  defenderPosition: AxialCoord,
  pushDirection: HexDirection,
  hasMomentum: boolean,
  chain: ChainResult
): CompressionResult {
  const events: GameEvent[] = [];

  // Get the attacker
  const attacker = getPieceById(state, attackerId);
  if (!attacker) {
    throw new Error(`Attacker with ID ${attackerId} not found`);
  }

  // Validate chain terminator is shield or throne
  if (chain.terminator !== 'shield' && chain.terminator !== 'throne') {
    throw new Error(
      `resolveCompression called with invalid terminator: ${chain.terminator}. Expected 'shield' or 'throne'.`
    );
  }

  // In compression, the chain pieces are already against the blocker and cannot move further.
  // The attacker pushes into the chain, taking the first defender's position.
  // The chain pieces remain in their current positions (compressed).

  // Build a list of positions in the chain, from defender position toward blocker
  const chainPositions: AxialCoord[] = [];
  let pos = defenderPosition;
  for (let i = 0; i < chain.pieces.length; i++) {
    chainPositions.push(pos);
    if (i < chain.pieces.length - 1) {
      pos = getNeighborAxial(pos, pushDirection);
    }
  }

  // Create MOVE event for attacker (placed first for proper event ordering)
  const moveEvent: MoveEvent = {
    type: 'MOVE',
    pieceId: attacker.id,
    from: attackerFrom,
    to: defenderPosition,
    hasMomentum,
  };
  events.push(moveEvent);

  // In a compression scenario, the chain pieces shift one position toward the blocker
  // (if there's space), or they stay put if they're already adjacent to the blocker.
  //
  // Actually, in compression, the chain is already at capacity - the terminator is
  // immediately behind the last piece. So:
  // - If chain has 1 piece: defender is adjacent to blocker, attacker pushes in,
  //   defender cannot move (blocked), so attacker stops adjacent to defender (blocked combat)
  //
  // Wait, let me reconsider: compression happens when push SUCCEEDS but chain cannot
  // fully expand. The attacker wins the combat but pieces compress instead of being eliminated.
  //
  // The key insight: when push succeeds and hits a blocker:
  // - All chain pieces shift one position toward the blocker
  // - The last piece stays put (it can't move past the blocker)
  // - Wait, that's not right either...
  //
  // Re-reading the PRD: "Pieces compress against blocker, No pieces eliminated, Attacker takes first defender's position"
  //
  // The correct interpretation:
  // - When a chain hits a shield/throne and CANNOT expand (chain length = available space),
  //   the pieces are already packed against the blocker
  // - The attacker's push "succeeds" in the sense that they take the defender's position
  // - But the chain pieces don't move - they're already maximally compressed
  // - Essentially, the defender "absorbs" into the compression

  // Actually, looking at edge push logic: pieces shift toward terminator.
  // For compression with shield/throne:
  // - If there's an empty hex before the blocker, pieces shift normally (but this would be 'empty' terminator)
  // - If chain is directly against blocker, pieces cannot shift further
  //
  // The key: detectChain returns 'shield' or 'throne' only when the chain ends AT the blocker,
  // meaning there's no gap. So in compression:
  // - Chain pieces are packed: [defender][piece2][..][pieceN][BLOCKER]
  // - Attacker pushes in from before defender
  // - Pieces cannot move toward blocker (no space)
  // - Attacker "takes" defender position - but where does defender go?
  //
  // This is the compression paradox. The answer from game rules:
  // - Push succeeds, meaning attacker has enough force
  // - But chain cannot physically move (blocked)
  // - Result: attacker stops ADJACENT to defender (the push doesn't fully execute)
  //
  // Wait no - re-reading PRD: "Attacker takes first defender's position"
  // This means the attacker DOES move to where the defender was.
  // And pieces compress - meaning they stack/overlap conceptually.
  //
  // In hex games, "compression" typically means:
  // - Each piece in chain moves one hex toward blocker
  // - Last piece is already at blocker, so it stays
  // - This creates a "gap" that the previous piece fills, etc.
  //
  // So for a chain [A->B->C->(SHIELD)]:
  // - A pushed by attacker
  // - A moves to B's spot, B moves to C's spot, C cannot move (blocked)
  // - Wait, but C is already adjacent to shield...
  //
  // I think the answer is: in compression, pieces DON'T shift, because the chain
  // is already at maximum density. The attacker simply joins the compressed mass.
  //
  // Let me check if the chain can have gaps: detectChain stops at first empty hex.
  // So if terminator is 'shield', the chain is [defender][p2][..][pN][SHIELD] with no gaps.
  // That means pieces 1..N are consecutive. When attacker pushes:
  // - There's no room for pieces to shift toward shield
  // - Attacker takes defender's position
  // - Defender must go... somewhere?
  //
  // Ah! I think I understand now. In compression, the push still "succeeds" combat-wise,
  // but physically the chain CANNOT move. The rule is:
  // - Attacker wins combat -> push should happen
  // - Chain cannot move -> attacker stops adjacent to defender (doesn't take their spot)
  //
  // But the PRD says "Attacker takes first defender's position". Let me re-read...
  //
  // Actually, I think the scenario is different. When detectChain returns 'shield' or 'throne',
  // it means the NEXT hex after the last chain piece is the blocker. So there IS room for
  // the chain to shift by one position:
  //
  // Before: [Attacker]->[Defender]->[P2]->[..]->[PN]-->(SHIELD)
  // After:  [empty]<-[Attacker]->[Defender]->[P2]->[..]->[PN](SHIELD)
  //
  // The chain shifts one position toward shield, PN ends up adjacent to shield (or stays if already adjacent).
  // Attacker takes Defender's old spot.
  //
  // This is consistent with edge push where pieces shift toward edge.
  // The difference: at edge, last piece falls off. At shield/throne, last piece just can't move further.

  // New positions for chain pieces - each shifts one toward blocker
  const newPositions = new Map<string, AxialCoord>();

  // For each piece in the chain, move it one position in push direction
  for (let i = 0; i < chain.pieces.length; i++) {
    const piece = chain.pieces[i];
    const currentPos = chainPositions[i];
    const newPos = getNeighborAxial(currentPos, pushDirection);

    // Check if the new position is the blocker position (shield or throne)
    // If so, the piece cannot move there and stays in place
    const isBlockerPosition =
      newPos.q === chain.terminatorPosition.q && newPos.r === chain.terminatorPosition.r;

    if (isBlockerPosition) {
      // This piece cannot move - it's adjacent to the blocker
      // It stays in its current position
      // No PUSH event generated since piece doesn't move
    } else {
      // Piece moves to new position
      newPositions.set(piece.id, newPos);

      // Create PUSH event
      const pushEvent: PushEvent = {
        type: 'PUSH',
        pieceId: piece.id,
        from: currentPos,
        to: newPos,
        pushDirection,
        depth: i, // Depth for staggered animation
      };
      events.push(pushEvent);
    }
  }

  // Attacker moves to defender's original position
  newPositions.set(attacker.id, defenderPosition);

  // Create the new pieces array with updated positions
  const newPieces = state.pieces.map((piece) => {
    const newPos = newPositions.get(piece.id);
    if (newPos) {
      return { ...piece, position: newPos };
    }
    return piece;
  });

  // Create the new state
  const newState: GameState = {
    ...state,
    pieces: newPieces,
  };

  return { newState, events };
}

/**
 * Result of resolving a push using the main resolver.
 */
export interface PushResult {
  /** The new game state after the push */
  newState: GameState;
  /** Events generated by the push (MOVE for attacker, PUSH for chain pieces, ELIMINATED if any) */
  events: GameEvent[];
  /** IDs of pieces that were eliminated (empty if none) */
  eliminatedPieceIds: string[];
}

/**
 * Main push resolver that handles all push scenarios.
 *
 * This function orchestrates push resolution by:
 * 1. Detecting the chain of pieces that will be affected
 * 2. Determining the chain terminator (edge, shield, throne, or empty)
 * 3. Routing to the appropriate resolution function
 *
 * Chain terminators and their resolutions:
 * - empty: Chain push - all pieces shift one position in push direction
 * - edge: Edge elimination - pieces pushed off board are eliminated (resolveEdgePush)
 * - shield: Compression - pieces compress against immovable shield (resolveCompression)
 * - throne: Compression - pieces compress against throne (resolveCompression)
 *
 * Events are generated with correct depth values for staggered animation:
 * - MOVE event for attacker (depth implicit)
 * - PUSH events for each chain piece with increasing depth
 * - ELIMINATED events for pieces pushed off edge
 *
 * @param state - The current game state
 * @param attackerId - The ID of the attacking piece
 * @param attackerFrom - The attacker's original position (before moving to attack)
 * @param defenderPosition - The defender's current position (first piece in chain)
 * @param pushDirection - The direction of the push (0-5 for hex directions)
 * @param hasMomentum - Whether the attacker moved 2 hexes (for MOVE event)
 * @returns PushResult with new state, events, and eliminated piece IDs
 */
export function resolvePush(
  state: GameState,
  attackerId: string,
  attackerFrom: AxialCoord,
  defenderPosition: AxialCoord,
  pushDirection: HexDirection,
  hasMomentum: boolean
): PushResult {
  // Detect the chain starting from the defender
  const chain = detectChain(state, defenderPosition, pushDirection);

  // Route to the appropriate resolution function based on chain terminator
  switch (chain.terminator) {
    case 'empty': {
      // Chain push - all pieces in the chain shift one position in push direction
      // For single-piece chains, this is equivalent to resolveSimplePush
      // For multi-piece chains, all pieces shift toward the empty hex

      const events: GameEvent[] = [];
      const attacker = getPieceById(state, attackerId);

      if (!attacker) {
        throw new Error(`Attacker with ID ${attackerId} not found`);
      }

      // Build positions for chain pieces (from defender toward empty hex)
      const chainPositions: AxialCoord[] = [];
      let pos = defenderPosition;
      for (let i = 0; i < chain.pieces.length; i++) {
        chainPositions.push(pos);
        pos = getNeighborAxial(pos, pushDirection);
      }

      // Build new positions - each piece shifts one position in push direction
      const newPositions = new Map<string, AxialCoord>();

      for (let i = 0; i < chain.pieces.length; i++) {
        const piece = chain.pieces[i];
        const currentPos = chainPositions[i];
        const newPos = getNeighborAxial(currentPos, pushDirection);

        newPositions.set(piece.id, newPos);

        // Create PUSH event for this piece
        const pushEvent: PushEvent = {
          type: 'PUSH',
          pieceId: piece.id,
          from: currentPos,
          to: newPos,
          pushDirection,
          depth: i, // Depth for staggered animation
        };
        events.push(pushEvent);
      }

      // Attacker moves to defender's original position
      newPositions.set(attacker.id, defenderPosition);

      // Create MOVE event for attacker (insert at beginning for proper event ordering)
      const moveEvent: MoveEvent = {
        type: 'MOVE',
        pieceId: attacker.id,
        from: attackerFrom,
        to: defenderPosition,
        hasMomentum,
      };
      events.unshift(moveEvent);

      // Create the new pieces array with updated positions
      const newPieces = state.pieces.map((piece) => {
        const newPos = newPositions.get(piece.id);
        if (newPos) {
          return { ...piece, position: newPos };
        }
        return piece;
      });

      // Create the new state
      const newState: GameState = {
        ...state,
        pieces: newPieces,
      };

      return {
        newState,
        events,
        eliminatedPieceIds: [], // No eliminations in empty terminator push
      };
    }

    case 'edge': {
      // Edge elimination - pieces pushed off board are eliminated
      const result = resolveEdgePush(
        state,
        attackerId,
        attackerFrom,
        defenderPosition,
        pushDirection,
        hasMomentum,
        chain
      );
      return {
        newState: result.newState,
        events: result.events,
        eliminatedPieceIds: result.eliminatedPieceIds,
      };
    }

    case 'shield':
    case 'throne': {
      // Compression - pieces compress against shield or throne
      const result = resolveCompression(
        state,
        attackerId,
        attackerFrom,
        defenderPosition,
        pushDirection,
        hasMomentum,
        chain
      );
      return {
        newState: result.newState,
        events: result.events,
        eliminatedPieceIds: [], // No eliminations in compression
      };
    }

    default: {
      // This should never happen if detectChain works correctly
      const exhaustiveCheck: never = chain.terminator;
      throw new Error(`Unknown chain terminator: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Result of checking for throne victory.
 */
export interface ThroneVictoryResult {
  /** Whether a throne victory occurred */
  isVictory: boolean;
  /** The player ID who won (if victory) */
  winnerId: string | null;
}

/**
 * Check if a throne victory occurred.
 * Throne victory happens when a Jarl voluntarily moves onto the Throne (center hex).
 *
 * Rules:
 * - Only Jarls can enter the Throne hex
 * - Victory is immediate when a Jarl voluntarily moves onto the Throne
 * - Being pushed onto the Throne does NOT count as a victory (compression prevents this anyway)
 * - Victory requires the move to be on the player's own turn
 *
 * @param state - The current game state (after the move was applied)
 * @param movedPieceId - The ID of the piece that was just moved
 * @param wasVoluntaryMove - Whether the move was voluntary (player's action) vs forced (push)
 * @returns ThroneVictoryResult indicating if victory occurred and who won
 */
export function checkThroneVictory(
  state: GameState,
  movedPieceId: string,
  wasVoluntaryMove: boolean
): ThroneVictoryResult {
  const noVictory: ThroneVictoryResult = { isVictory: false, winnerId: null };

  // If the move wasn't voluntary (e.g., a push), no victory
  if (!wasVoluntaryMove) {
    return noVictory;
  }

  // Find the moved piece
  const movedPiece = getPieceById(state, movedPieceId);
  if (!movedPiece) {
    return noVictory;
  }

  // Only Jarls can win by entering the Throne
  if (movedPiece.type !== 'jarl') {
    return noVictory;
  }

  // Check if the Jarl is on the Throne (center hex at 0,0)
  const thronePosition: AxialCoord = { q: 0, r: 0 };
  if (movedPiece.position.q !== thronePosition.q || movedPiece.position.r !== thronePosition.r) {
    return noVictory;
  }

  // Victory! The Jarl voluntarily moved onto the Throne
  return {
    isVictory: true,
    winnerId: movedPiece.playerId,
  };
}
