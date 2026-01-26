// Move validation, execution, and related functions

import type {
  AxialCoord,
  HexDirection,
  GameState,
  MoveCommand,
  CombatResult,
  ValidMove,
  MoveResult,
  GameEvent,
  MoveEvent,
  TurnEndedEvent,
  GameEndedEvent,
  MoveValidation,
  ThroneVictoryResult,
  EliminatePlayerResult,
  LastStandingResult,
  WinConditionsResult,
  ReachableHex,
} from './types.js';

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
} from './hex.js';

import { getPieceAt, getPieceById, calculateCombat, resolvePush } from './combat.js';

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
