// Core combat calculation functions
// This module contains the pure combat calculation logic:
// - calculateAttack, calculateDefense, calculateCombat
// - Supporting functions: getPieceStrength, findInlineSupport, findBracing

import type {
  AxialCoord,
  HexDirection,
  Piece,
  GameState,
  CombatBreakdown,
  CombatResult,
  InlineSupportResult,
  BracingResult,
} from './types.js';

import {
  axialToCube,
  cubeToAxial,
  getNeighbor,
  getOppositeDirection,
  isOnBoard,
  hexToKey,
} from './hex.js';

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
