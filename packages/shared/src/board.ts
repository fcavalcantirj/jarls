// Board generation functions for Jarls game
// Handles hex board generation, starting positions, hole placement, and initial game setup

import type {
  AxialCoord,
  CubeCoord,
  HexDirection,
  Piece,
  Player,
  GameConfig,
  PlayerScaling,
  GameState,
  TerrainType,
} from './types.js';

import {
  axialToCube,
  cubeToAxial,
  hexDistance,
  getNeighbor,
  hexLineAxial,
  isOnBoardAxial,
  isOnEdgeAxial,
  hexToKey,
} from './hex.js';

// Board scaling configuration based on player count
// From the ruleset scaling table:
// | Players | Board Radius | Warriors/Player |
// | 2       | 3            | 5               |
// | 3       | 5            | 5               |
// | 4       | 6            | 4               |
// | 5       | 7            | 4               |
// | 6       | 8            | 4               |

const PLAYER_SCALING: Record<number, PlayerScaling> = {
  2: { boardRadius: 3, warriorCount: 5 },
  3: { boardRadius: 5, warriorCount: 5 },
  4: { boardRadius: 6, warriorCount: 4 },
  5: { boardRadius: 7, warriorCount: 4 },
  6: { boardRadius: 8, warriorCount: 4 },
};

// Hole counts per terrain type
const TERRAIN_HOLE_COUNTS: Record<TerrainType, number> = {
  calm: 3,
  treacherous: 6,
  chaotic: 9,
};

// Default player colors for up to 6 players
export const PLAYER_COLORS = [
  '#E53935', // Red
  '#1E88E5', // Blue
  '#43A047', // Green
  '#FB8C00', // Orange
  '#8E24AA', // Purple
  '#00ACC1', // Cyan
];

/**
 * Get the game configuration for a given player count.
 * Returns scaling values from the ruleset:
 * - Board radius (hex grid size)
 * - Number of warriors per player
 * - Terrain type (determines hole count)
 *
 * @param playerCount - Number of players (2-6)
 * @param turnTimerMs - Optional turn timer in milliseconds (null for no timer)
 * @param terrain - Terrain type (calm=3 holes, treacherous=6 holes, chaotic=9 holes)
 * @returns GameConfig object with all configuration values
 * @throws Error if playerCount is outside valid range (2-6)
 */
export function getConfigForPlayerCount(
  playerCount: number,
  turnTimerMs: number | null = null,
  terrain: TerrainType = 'calm'
): GameConfig {
  const scaling = PLAYER_SCALING[playerCount];

  if (!scaling) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  return {
    playerCount,
    boardRadius: scaling.boardRadius,
    warriorCount: scaling.warriorCount,
    turnTimerMs,
    terrain,
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
 * Generate random hole positions for the game board.
 * Holes are deadly pits that eliminate pieces when they fall in.
 *
 * Rules:
 * - Hole count is determined by terrain type (calm=3, treacherous=6, chaotic=9)
 * - No holes on the Throne (center hex at 0,0)
 * - No holes on edge hexes
 * - No holes adjacent to edges (2 hex buffer from edge)
 * - No holes on starting positions or warrior paths
 * - Holes are placed randomly (not symmetrically)
 *
 * @param radius - Board radius
 * @param terrain - Terrain type that determines hole count
 * @param startingPositions - Array of starting positions to avoid
 * @returns Array of hole positions in axial coordinates
 */
export function generateRandomHoles(
  radius: number,
  terrain: TerrainType,
  startingPositions: AxialCoord[]
): AxialCoord[] {
  const baseHoleCount = TERRAIN_HOLE_COUNTS[terrain];

  if (baseHoleCount <= 0) {
    return [];
  }

  // Scale hole count by board area ratio (base = radius 3 with 37 hexes)
  // Using sqrt of area ratio keeps holes proportional without overwhelming large boards
  const boardHexes = 3 * radius * radius + 3 * radius + 1;
  const baseHexes = 37; // radius 3 board
  const areaRatio = boardHexes / baseHexes;
  const holeCount = Math.round(baseHoleCount * Math.sqrt(areaRatio));

  // Get all hexes and filter to valid hole positions
  const allHexes = generateAllBoardHexes(radius);
  const center: CubeCoord = { q: 0, r: 0, s: 0 };

  // Build set of positions to avoid
  const avoidKeys = new Set<string>();

  // Add throne
  avoidKeys.add(hexToKey({ q: 0, r: 0 }));

  // Add starting positions
  for (const pos of startingPositions) {
    avoidKeys.add(hexToKey(pos));
  }

  // Add hexes on paths from starting positions to throne
  const throne: AxialCoord = { q: 0, r: 0 };
  for (const startPos of startingPositions) {
    const pathHexes = hexLineAxial(startPos, throne);
    for (const hex of pathHexes) {
      avoidKeys.add(hexToKey(hex));
    }
  }

  // Filter to valid hole positions:
  // - Distance from center >= 1 (not throne)
  // - Distance from center <= radius - 2 (2 hex buffer from edge)
  const validHexes = allHexes.filter((hex) => {
    const dist = hexDistance(hex, center);
    // Must be interior with 2-hex buffer from edge
    if (dist < 1 || dist > radius - 2) {
      return false;
    }
    // Must not be on avoided positions
    const axialHex = cubeToAxial(hex);
    if (avoidKeys.has(hexToKey(axialHex))) {
      return false;
    }
    return true;
  });

  // Shuffle the valid hexes
  const shuffled = [...validHexes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Take the first holeCount hexes
  const holes: AxialCoord[] = [];
  for (let i = 0; i < Math.min(holeCount, shuffled.length); i++) {
    holes.push(cubeToAxial(shuffled[i]));
  }

  return holes;
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
 * - Warriors cannot occupy hexes with holes
 * - If a hex is blocked, skip to the next available hex toward the center
 *
 * @param jarlPosition - The Jarl's starting position
 * @param warriorCount - Number of Warriors to place
 * @param holePositions - Set of hole position keys to avoid
 * @param radius - Board radius (for bounds checking)
 * @returns Array of Warrior positions in axial coordinates
 */
export function placeWarriors(
  jarlPosition: AxialCoord,
  warriorCount: number,
  holePositions: Set<string>,
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

    // Skip Jarl position, Throne, holes, and already used positions
    if (key === jarlKey || key === throneKey || holePositions.has(key) || usedKeys.has(key)) {
      continue;
    }

    // Skip if off board
    if (!isOnBoardAxial(hex, radius)) {
      continue;
    }

    warriors.push(hex);
    usedKeys.add(key);
  }

  // If we couldn't place all warriors on the direct path (due to holes),
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
        !holePositions.has(key) &&
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
          !holePositions.has(key) &&
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
 * - Generating random holes based on terrain type
 * - Placing each player's Jarl at their starting position
 * - Placing each player's Warriors in front of their Jarl
 *
 * @param playerNames - Array of player names (2-6 players)
 * @param turnTimerMs - Optional turn timer in milliseconds (null for no timer)
 * @param customBoardRadius - Optional custom board radius (overrides default for player count)
 * @param terrain - Terrain type determining hole count (default: 'calm')
 * @returns Complete GameState ready for the playing phase
 */
export function createInitialState(
  playerNames: string[],
  turnTimerMs: number | null = null,
  customBoardRadius?: number,
  terrain: TerrainType = 'calm'
): GameState {
  const playerCount = playerNames.length;

  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Invalid player count: ${playerCount}. Must be between 2 and 6.`);
  }

  // Get game configuration for this player count
  const config = getConfigForPlayerCount(playerCount, turnTimerMs, terrain);

  // Override board radius if custom value provided
  if (customBoardRadius !== undefined) {
    config.boardRadius = customBoardRadius;
  }

  // Create players with IDs and colors
  const players: Player[] = playerNames.map((name, index) => ({
    id: generateId(),
    name,
    color: PLAYER_COLORS[index],
    isEliminated: false,
  }));

  // Calculate starting positions for Jarls
  const startingPositions = calculateStartingPositions(playerCount, config.boardRadius);

  // Generate random holes based on terrain (avoiding starting positions and paths)
  const holes = generateRandomHoles(config.boardRadius, terrain, startingPositions);

  // Create hole position set for quick lookup
  const holeSet = new Set(holes.map(hexToKey));

  // Create all pieces
  const pieces: Piece[] = [];

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
      holeSet,
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
    holes,
    currentPlayerId: players[0].id, // First player starts
    turnNumber: 0,
    roundNumber: 0,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  };

  return gameState;
}
