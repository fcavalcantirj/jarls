// @jarls/shared - Shared types and utilities

// Re-export all types from types.ts
export type {
  AxialCoord,
  CubeCoord,
  HexDirection,
  PieceType,
  Piece,
  Player,
  GameConfig,
  PlayerScaling,
  GamePhase,
  GameState,
  MoveCommand,
  CombatBreakdown,
  CombatResult,
  ValidMove,
  MoveResult,
  GameEvent,
  MoveEvent,
  PushEvent,
  EliminatedEvent,
  TurnEndedEvent,
  GameEndedEvent,
  StarvationTriggeredEvent,
  StarvationResolvedEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  MoveValidationError,
  MoveValidation,
  InlineSupportResult,
  BracingResult,
  SimplePushResult,
  ChainTerminator,
  ChainResult,
  EdgePushResult,
  CompressionResult,
  PushResult,
  ThroneVictoryResult,
  EliminatePlayerResult,
  LastStandingResult,
  WinCondition,
  WinConditionsResult,
  ReachableHex,
} from './types.js';

// Import types for internal use
import type {
  AxialCoord,
  HexDirection,
  Piece,
  GameState,
  MoveCommand,
  CombatBreakdown,
  CombatResult,
  ValidMove,
  MoveResult,
  GameEvent,
  MoveEvent,
  PushEvent,
  EliminatedEvent,
  TurnEndedEvent,
  GameEndedEvent,
  MoveValidation,
  InlineSupportResult,
  BracingResult,
  SimplePushResult,
  ChainResult,
  EdgePushResult,
  CompressionResult,
  PushResult,
  ThroneVictoryResult,
  EliminatePlayerResult,
  LastStandingResult,
  WinConditionsResult,
  ReachableHex,
} from './types.js';

export const VERSION = '0.1.0';

// Re-export all hex coordinate functions from hex.ts
export {
  DIRECTIONS,
  axialToCube,
  cubeToAxial,
  hexDistance,
  hexDistanceAxial,
  getNeighbor,
  getAllNeighbors,
  getNeighborAxial,
  getAllNeighborsAxial,
  getOppositeDirection,
  cubeRound,
  hexLine,
  hexLineAxial,
  isOnBoard,
  isOnBoardAxial,
  isOnEdge,
  isOnEdgeAxial,
  hexToKey,
  keyToHex,
  keyToHexCube,
} from './hex.js';

// Import hex functions for internal use
import {
  DIRECTIONS,
  axialToCube,
  cubeToAxial,
  hexDistanceAxial,
  getNeighbor,
  getNeighborAxial,
  getOppositeDirection,
  hexLineAxial,
  isOnBoard,
  isOnBoardAxial,
  hexToKey,
} from './hex.js';

// Re-export all board functions from board.ts
export {
  getConfigForPlayerCount,
  getBoardHexCount,
  generateAllBoardHexes,
  generateAllBoardHexesAxial,
  hexToPixel,
  hexToAngle,
  calculateStartingPositions,
  rotateHex,
  generateSymmetricalShields,
  hasPathToThrone,
  validateShieldPlacement,
  getDirectionTowardThrone,
  placeWarriors,
  generateId,
  createInitialState,
} from './board.js';

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
 * Check if a 2-hex move path crosses through the Throne (0,0).
 * Used to detect when a Jarl's 2-hex move should stop at the Throne.
 *
 * @param start - The starting position
 * @param end - The destination position
 * @returns The Throne position {q:0, r:0} if the path crosses through it, null otherwise
 */
export function pathCrossesThrone(start: AxialCoord, end: AxialCoord): AxialCoord | null {
  // Get all hexes on the line from start to end
  const pathHexes = hexLineAxial(start, end);

  // Check if any intermediate hex (not start or end) is the Throne
  for (let i = 1; i < pathHexes.length - 1; i++) {
    const hex = pathHexes[i];
    if (hex.q === 0 && hex.r === 0) {
      return { q: 0, r: 0 };
    }
  }

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

  // 13. Check if Jarl 2-hex move crosses through the Throne
  // If so, the Jarl stops at the Throne (and wins immediately)
  let adjustedDestination: AxialCoord | undefined;
  if (piece.type === 'jarl' && distance === 2) {
    const thronePosition = pathCrossesThrone(piece.position, destination);
    if (thronePosition) {
      // Jarl will stop at the Throne instead of the original destination
      adjustedDestination = thronePosition;
    }
  }

  // Move is valid
  const hasMomentum = distance === 2;
  return { isValid: true, hasMomentum, adjustedDestination };
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

    // Note: The throne (center hex at 0,0) does NOT block pushes.
    // Pieces can be pushed onto the throne (they just can't voluntarily move there).
    // If the throne is empty, it acts like any other empty hex for push purposes.
    // If there's a piece on the throne, it becomes part of the chain.

    currentPos = nextPos;
  }
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

/**
 * Eliminate a player from the game.
 * This is called when a player's Jarl is pushed off the board.
 *
 * Effects:
 * - Marks the player as eliminated (isEliminated = true)
 * - Removes all remaining Warriors belonging to the player
 * - The Jarl is assumed to already be removed (by the push that eliminated them)
 * - Player cannot take further turns
 *
 * Note: This function does NOT check for win conditions. The caller should
 * check for last-standing victory after calling this function.
 *
 * @param state - The current game state
 * @param playerId - The ID of the player to eliminate
 * @returns EliminatePlayerResult with new state, events, and removed piece IDs
 */
export function eliminatePlayer(state: GameState, playerId: string): EliminatePlayerResult {
  // Find the player
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    // Player not found - return unchanged state
    return {
      newState: state,
      events: [],
      removedPieceIds: [],
    };
  }

  // Check if player is already eliminated
  if (state.players[playerIndex].isEliminated) {
    // Player already eliminated - return unchanged state
    return {
      newState: state,
      events: [],
      removedPieceIds: [],
    };
  }

  // Find all Warriors belonging to this player (Jarl should already be removed)
  const warriorsToRemove = state.pieces.filter(
    (p) => p.playerId === playerId && p.type === 'warrior'
  );
  const removedPieceIds = warriorsToRemove.map((p) => p.id);

  // Generate ELIMINATED events for each removed warrior
  const events: GameEvent[] = warriorsToRemove.map((warrior) => ({
    type: 'ELIMINATED' as const,
    pieceId: warrior.id,
    playerId: warrior.playerId,
    position: warrior.position,
    cause: 'starvation' as const, // Using 'starvation' as the cause since this is player elimination
  }));

  // Create new players array with this player marked as eliminated
  const newPlayers = state.players.map((player, index) =>
    index === playerIndex ? { ...player, isEliminated: true } : player
  );

  // Create new pieces array without the removed Warriors
  const removedPieceIdSet = new Set(removedPieceIds);
  const newPieces = state.pieces.filter((p) => !removedPieceIdSet.has(p.id));

  // Create new state
  const newState: GameState = {
    ...state,
    players: newPlayers,
    pieces: newPieces,
  };

  return {
    newState,
    events,
    removedPieceIds,
  };
}

/**
 * Check if a last-standing victory has occurred.
 * A last-standing victory occurs when only one Jarl remains on the board.
 *
 * This should be called after any elimination to check if the game should end.
 *
 * @param state - The current game state
 * @returns LastStandingResult indicating if victory occurred and who won
 */
export function checkLastStanding(state: GameState): LastStandingResult {
  const noVictory: LastStandingResult = { isVictory: false, winnerId: null };

  // Find all Jarls on the board
  const jarls = state.pieces.filter((p) => p.type === 'jarl');

  // If there's more than one Jarl, no last-standing victory
  if (jarls.length > 1) {
    return noVictory;
  }

  // If there's exactly one Jarl, that player wins
  if (jarls.length === 1) {
    return {
      isVictory: true,
      winnerId: jarls[0].playerId,
    };
  }

  // If there are no Jarls (edge case - shouldn't happen in normal gameplay),
  // no victory can be determined
  return noVictory;
}

/**
 * Check all win conditions with proper precedence.
 *
 * Win condition priority:
 * 1. Throne Victory - checked first (Jarl voluntarily moves onto Throne)
 * 2. Last Standing - checked second (only one Jarl remains on the board)
 *
 * This function should be called after every move to determine if the game has ended.
 *
 * @param state - The current game state (after the move was applied)
 * @param movedPieceId - The ID of the piece that was just moved (for throne check)
 * @param wasVoluntaryMove - Whether the move was voluntary (for throne check)
 * @returns WinConditionsResult indicating if victory occurred, who won, and how
 */
export function checkWinConditions(
  state: GameState,
  movedPieceId: string,
  wasVoluntaryMove: boolean
): WinConditionsResult {
  const noVictory: WinConditionsResult = { isVictory: false, winnerId: null, condition: null };

  // Check throne victory first (higher precedence)
  const throneResult = checkThroneVictory(state, movedPieceId, wasVoluntaryMove);
  if (throneResult.isVictory) {
    return {
      isVictory: true,
      winnerId: throneResult.winnerId,
      condition: 'throne',
    };
  }

  // Check last standing victory second
  const lastStandingResult = checkLastStanding(state);
  if (lastStandingResult.isVictory) {
    return {
      isVictory: true,
      winnerId: lastStandingResult.winnerId,
      condition: 'lastStanding',
    };
  }

  // No victory condition met
  return noVictory;
}

/**
 * Get all reachable hexes for a piece.
 * Returns all valid destinations where the piece can move or attack.
 *
 * Rules:
 * - Warriors can move 1 or 2 hexes in straight lines
 * - Jarls can move 1 hex normally, or 2 hexes with draft formation
 * - Pieces cannot move through other pieces (path must be clear)
 * - Pieces cannot land on friendly pieces
 * - Warriors cannot enter the Throne
 * - Shields cannot move
 * - Moving 2 hexes grants momentum (+1 attack)
 *
 * @param state - The current game state
 * @param pieceId - The ID of the piece to get reachable hexes for
 * @returns Array of ReachableHex objects representing valid destinations
 */
export function getReachableHexes(state: GameState, pieceId: string): ReachableHex[] {
  const piece = getPieceById(state, pieceId);
  if (!piece) {
    return [];
  }

  // Shields cannot move
  if (piece.type === 'shield') {
    return [];
  }

  // At this point, piece is a Warrior or Jarl, which always have a playerId
  const playerId = piece.playerId;
  if (!playerId) {
    return []; // Should never happen for Warriors/Jarls, but TypeScript needs this
  }

  const results: ReachableHex[] = [];
  const radius = state.config.boardRadius;

  // Determine maximum move distance based on piece type
  // Warriors can always move 1-2 hexes
  // Jarls can move 1 hex, or 2 with draft
  const maxDistance = piece.type === 'warrior' ? 2 : 1;

  // For Jarls, check which directions have draft formation (can move 2 hexes)
  const draftDirections =
    piece.type === 'jarl' ? hasDraftFormation(state, piece.position, playerId) : [];

  // Check all 6 directions
  for (let dir = 0; dir < 6; dir++) {
    const direction = dir as HexDirection;

    // Determine max distance for this direction
    let dirMaxDistance = maxDistance;
    if (piece.type === 'jarl' && draftDirections.includes(direction)) {
      // Jarl can move 2 hexes in this direction with draft
      dirMaxDistance = 2;
    }

    // Check each distance (1 and possibly 2)
    let currentPos = piece.position;
    for (let dist = 1; dist <= dirMaxDistance; dist++) {
      // Get the next hex in this direction
      const nextPos = getNeighborAxial(currentPos, direction);

      // Check if the hex is on the board
      if (!isOnBoardAxial(nextPos, radius)) {
        break; // Can't go further in this direction
      }

      // Check if path is blocked (only need to check for distance > 1)
      // For distance 1, we check if there's a piece at destination
      // For distance 2, we check if there's a piece at the intermediate hex
      if (dist > 1) {
        // Check if the path is clear (intermediate hex has a piece)
        const intermediatePiece = getPieceAt(state, currentPos);
        if (intermediatePiece && intermediatePiece.id !== piece.id) {
          break; // Path is blocked by intermediate piece
        }
      }

      // Check what's at the destination
      const pieceAtDest = getPieceAt(state, nextPos);

      // Cannot land on friendly pieces or shields
      if (pieceAtDest && (pieceAtDest.playerId === playerId || pieceAtDest.type === 'shield')) {
        break; // Can't move to or through friendly pieces or shields
      }

      // Warriors cannot enter the Throne
      if (piece.type === 'warrior' && nextPos.q === 0 && nextPos.r === 0) {
        // Continue checking next distance - throne blocks but doesn't stop path
        currentPos = nextPos;
        continue;
      }

      // Determine if this is a move or attack
      // Attack only when there's an enemy piece (not shield, which we already filtered)
      const moveType: 'move' | 'attack' =
        pieceAtDest && pieceAtDest.playerId !== null && pieceAtDest.playerId !== playerId
          ? 'attack'
          : 'move';

      // Check if this move grants momentum (moving 2 hexes)
      const hasMomentum = dist === 2;

      results.push({
        destination: nextPos,
        moveType,
        hasMomentum,
        direction,
      });

      // If there's an enemy piece at this hex, we can attack but can't go further
      if (pieceAtDest) {
        break;
      }

      // Update current position for next iteration
      currentPos = nextPos;
    }
  }

  return results;
}

/**
 * Get all valid moves for a piece with combat previews.
 * This builds on getReachableHexes by adding combat result previews for attacks.
 *
 * Each ValidMove includes:
 * - destination: The target hex position
 * - moveType: 'move' for empty hex, 'attack' for enemy-occupied hex
 * - hasMomentum: Whether moving to this hex grants +1 attack bonus
 * - combatPreview: For attacks, the full CombatResult showing outcome
 *
 * @param state - The current game state
 * @param pieceId - The ID of the piece to get valid moves for
 * @returns Array of ValidMove objects with combat previews for attacks
 */
export function getValidMoves(state: GameState, pieceId: string): ValidMove[] {
  const piece = getPieceById(state, pieceId);
  if (!piece) {
    return [];
  }

  // Get all reachable hexes
  const reachableHexes = getReachableHexes(state, pieceId);

  // Convert to ValidMove[] with combat previews
  return reachableHexes.map((reachable) => {
    let combatPreview: CombatResult | null = null;

    if (reachable.moveType === 'attack') {
      // Get the defender at the destination
      const defender = getPieceAt(state, reachable.destination);
      if (defender && piece.playerId) {
        // Calculate combat preview
        // The attacker position is adjacent to the defender (one hex before destination)
        const attackerCombatPosition = getNeighborAxial(
          reachable.destination,
          getOppositeDirection(reachable.direction)
        );

        // Create a temporary state with the attacker at the combat position
        // This ensures proper support calculation (attacker's original position is empty)
        const tempState: GameState = {
          ...state,
          pieces: state.pieces.map((p) =>
            p.id === piece.id ? { ...p, position: attackerCombatPosition } : p
          ),
        };

        combatPreview = calculateCombat(
          tempState,
          { ...piece, position: attackerCombatPosition },
          attackerCombatPosition,
          defender,
          reachable.destination,
          reachable.direction,
          reachable.hasMomentum
        );
      }
    }

    return {
      destination: reachable.destination,
      moveType: reachable.moveType,
      hasMomentum: reachable.hasMomentum,
      combatPreview,
    };
  });
}

/**
 * Get the next player in turn order who is not eliminated.
 * Wraps around to the first player after the last player.
 *
 * @param state - The current game state
 * @param currentPlayerId - The current player's ID
 * @returns The ID of the next active (non-eliminated) player
 */
function getNextActivePlayerId(state: GameState, currentPlayerId: string): string {
  const activePlayers = state.players.filter((p) => !p.isEliminated);
  if (activePlayers.length === 0) {
    return currentPlayerId; // Shouldn't happen, but fallback
  }

  const currentIndex = activePlayers.findIndex((p) => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex].id;
}

/**
 * Apply a move to the game state, handling all scenarios:
 * - Simple move (no combat)
 * - Attack with push (defender pushed)
 * - Blocked attack (attacker stops adjacent to defender)
 *
 * This is the main entry point for executing moves. It:
 * 1. Validates the move
 * 2. Applies the move (including combat resolution)
 * 3. Handles player elimination if a Jarl is pushed off
 * 4. Checks win conditions
 * 5. Advances the turn
 * 6. Generates all animation events
 *
 * @param state - The current game state
 * @param playerId - The ID of the player making the move
 * @param command - The move command (pieceId and destination)
 * @returns MoveResult with success status, new state, and events
 */
export function applyMove(state: GameState, playerId: string, command: MoveCommand): MoveResult {
  // 1. Validate the move
  const validation = validateMove(state, playerId, command);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
      newState: state,
      events: [],
    };
  }

  const { pieceId } = command;
  // Use adjusted destination if Jarl's 2-hex move crosses the Throne
  const destination = validation.adjustedDestination ?? command.destination;
  const piece = getPieceById(state, pieceId)!; // Validated above
  const hasMomentum = validation.hasMomentum ?? false;
  const events: GameEvent[] = [];

  // Get the direction of movement (use original destination for direction calculation)
  const direction = getLineDirection(piece.position, command.destination)!; // Validated as straight line

  // Check if there's an enemy piece at the destination (attack)
  // Note: When Jarl crosses Throne, the adjusted destination is the Throne,
  // which cannot have an enemy piece (Warriors can't enter, Jarls can't start there)
  const targetPiece = getPieceAt(state, destination);
  const isAttack = targetPiece !== undefined && targetPiece.playerId !== playerId;

  let resultState: GameState;
  let eliminatedJarlPlayerId: string | null = null;

  if (isAttack) {
    // Attack scenario - calculate combat
    // For combat calculation, the attacker is positioned adjacent to the defender
    // (one hex before destination if moving 2 hexes, or at the piece's original position if moving 1 hex)
    const attackerCombatPosition = hasMomentum
      ? getNeighborAxial(destination, getOppositeDirection(direction))
      : piece.position;

    // Create temporary state with attacker at combat position for accurate support calculation
    const tempState: GameState = {
      ...state,
      pieces: state.pieces.map((p) =>
        p.id === piece.id ? { ...p, position: attackerCombatPosition } : p
      ),
    };

    const combatResult = calculateCombat(
      tempState,
      { ...piece, position: attackerCombatPosition },
      attackerCombatPosition,
      targetPiece,
      destination,
      direction,
      hasMomentum
    );

    if (combatResult.outcome === 'push') {
      // Push succeeds - use resolvePush to handle the push chain
      const pushResult = resolvePush(
        state,
        pieceId,
        piece.position,
        destination,
        direction,
        hasMomentum
      );

      resultState = pushResult.newState;
      events.push(...pushResult.events);

      // Check if any eliminated piece was a Jarl
      for (const eliminatedId of pushResult.eliminatedPieceIds) {
        const eliminatedPiece = getPieceById(state, eliminatedId);
        if (eliminatedPiece && eliminatedPiece.type === 'jarl' && eliminatedPiece.playerId) {
          eliminatedJarlPlayerId = eliminatedPiece.playerId;
        }
      }
    } else {
      // Attack blocked - attacker moves to adjacent position (one hex before destination)
      const blockedPosition = getNeighborAxial(destination, getOppositeDirection(direction));

      // Update piece position
      resultState = {
        ...state,
        pieces: state.pieces.map((p) =>
          p.id === pieceId ? { ...p, position: blockedPosition } : p
        ),
      };

      // Generate MOVE event (to the blocked position)
      const moveEvent: MoveEvent = {
        type: 'MOVE',
        pieceId,
        from: piece.position,
        to: blockedPosition,
        hasMomentum,
      };
      events.push(moveEvent);
    }
  } else {
    // Simple move - no combat
    resultState = {
      ...state,
      pieces: state.pieces.map((p) => (p.id === pieceId ? { ...p, position: destination } : p)),
    };

    // Generate MOVE event
    const moveEvent: MoveEvent = {
      type: 'MOVE',
      pieceId,
      from: piece.position,
      to: destination,
      hasMomentum,
    };
    events.push(moveEvent);
  }

  // Handle player elimination if a Jarl was pushed off
  if (eliminatedJarlPlayerId) {
    const eliminationResult = eliminatePlayer(resultState, eliminatedJarlPlayerId);
    resultState = eliminationResult.newState;
    events.push(...eliminationResult.events);
  }

  // Check win conditions
  // For throne victory, the piece ID to check is the one that moved (could be attacker taking throne)
  // wasVoluntaryMove is true for attacker's move, false for pushed pieces
  const wasVoluntaryMove = true; // The attacker's move is always voluntary
  const winCheck = checkWinConditions(resultState, pieceId, wasVoluntaryMove);

  if (winCheck.isVictory && winCheck.winnerId && winCheck.condition) {
    // Game ends - set winner and phase
    resultState = {
      ...resultState,
      phase: 'ended',
      winnerId: winCheck.winnerId,
      winCondition: winCheck.condition,
    };

    // Add game ended event
    const gameEndedEvent: GameEndedEvent = {
      type: 'GAME_ENDED',
      winnerId: winCheck.winnerId,
      winCondition: winCheck.condition,
    };
    events.push(gameEndedEvent);

    // Return early - don't advance turn
    return {
      success: true,
      newState: resultState,
      events,
    };
  }

  // Advance turn
  const nextPlayerId = getNextActivePlayerId(resultState, playerId);
  const newTurnNumber = resultState.turnNumber + 1;

  // Check if a round has completed (all active players have taken a turn)
  // A round completes when we wrap back to the first player
  const activePlayers = resultState.players.filter((p) => !p.isEliminated);
  const firstActivePlayer = activePlayers[0];
  const isNewRound = nextPlayerId === firstActivePlayer?.id && newTurnNumber > 0;
  const newRoundNumber = isNewRound ? resultState.roundNumber + 1 : resultState.roundNumber;

  // Update rounds since elimination
  // Reset to 0 if any piece was eliminated, otherwise increment on new round
  const pieceWasEliminated = events.some((e) => e.type === 'ELIMINATED');
  let newRoundsSinceElimination = resultState.roundsSinceElimination;
  if (pieceWasEliminated) {
    newRoundsSinceElimination = 0;
  } else if (isNewRound) {
    newRoundsSinceElimination = resultState.roundsSinceElimination + 1;
  }

  resultState = {
    ...resultState,
    currentPlayerId: nextPlayerId,
    turnNumber: newTurnNumber,
    roundNumber: newRoundNumber,
    roundsSinceElimination: newRoundsSinceElimination,
  };

  // Add turn ended event
  const turnEndedEvent: TurnEndedEvent = {
    type: 'TURN_ENDED',
    playerId,
    nextPlayerId,
    turnNumber: newTurnNumber,
  };
  events.push(turnEndedEvent);

  return {
    success: true,
    newState: resultState,
    events,
  };
}
