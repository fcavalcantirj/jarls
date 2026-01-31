// Move validation functions - path checking, draft formation detection, move validation

import type { AxialCoord, HexDirection, GameState, MoveCommand, MoveValidation } from './types.js';

import {
  DIRECTIONS,
  axialToCube,
  cubeToAxial,
  hexDistanceAxial,
  getNeighbor,
  getOppositeDirection,
  hexLineAxial,
  hexToKey,
  isOnBoard,
  isOnBoardAxial,
} from './hex.js';

import { getPieceAt, getPieceById } from './combat-core.js';

/**
 * Check if a path between two hexes is clear of pieces and holes.
 * A path is clear if no pieces or holes exist on any hex between the start and end (exclusive).
 * The start and end hexes themselves are not checked.
 *
 * This is used to validate moves - pieces cannot move through other pieces or holes.
 *
 * @param state - The current game state
 * @param start - Starting hex position (exclusive - not checked for pieces/holes)
 * @param end - Ending hex position (exclusive - not checked for pieces/holes)
 * @returns true if all hexes between start and end are empty (no pieces or holes), false otherwise
 */
export function isPathClear(state: GameState, start: AxialCoord, end: AxialCoord): boolean {
  // Get all hexes along the line from start to end
  const pathHexes = hexLineAxial(start, end);

  // Build a set of hole positions for quick lookup
  const holes = state.holes || [];
  const holeSet = new Set(holes.map(hexToKey));

  // Check each hex between start and end (exclusive of both endpoints)
  // pathHexes[0] is start, pathHexes[pathHexes.length - 1] is end
  for (let i = 1; i < pathHexes.length - 1; i++) {
    const hex = pathHexes[i];
    if (getPieceAt(state, hex) !== undefined) {
      return false; // Piece blocks the path
    }
    if (holeSet.has(hexToKey(hex))) {
      return false; // Hole blocks the path
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
      // Enemy pieces block the draft line
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
 * - Enemy pieces block the draft line
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

  // 5. Check destination is on the board
  if (!isOnBoardAxial(destination, state.config.boardRadius)) {
    return { isValid: false, error: 'DESTINATION_OFF_BOARD' };
  }

  // 6. Check destination is not a hole
  const holes = state.holes || [];
  const holeSet = new Set(holes.map(hexToKey));
  if (holeSet.has(hexToKey(destination))) {
    return { isValid: false, error: 'DESTINATION_IS_HOLE' };
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
