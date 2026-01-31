// Move execution, win conditions, and related functions

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
  ThroneVictoryResult,
  EliminatePlayerResult,
  LastStandingResult,
  WinConditionsResult,
  ReachableHex,
  MoveHistoryEntry,
} from './types.js';

import { getNeighborAxial, getOppositeDirection, isOnBoardAxial, hexToKey } from './hex.js';

import { getPieceAt, getPieceById, calculateCombat, resolvePush } from './combat.js';

// Re-export all validation functions from move-validation.ts
export {
  isPathClear,
  hasDraftFormationInDirection,
  hasDraftFormation,
  getDirectionBetweenAdjacent,
  getLineDirection,
  pathCrossesThrone,
  validateMove,
} from './move-validation.js';

// Import validation functions for internal use
import { hasDraftFormation, getLineDirection, validateMove } from './move-validation.js';

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
    cause: 'edge' as const, // Warriors removed when their Jarl is pushed off the edge
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

  // At this point, piece is a Warrior or Jarl, which always have a playerId
  const playerId = piece.playerId;
  if (!playerId) {
    return []; // Should never happen for Warriors/Jarls, but TypeScript needs this
  }

  const results: ReachableHex[] = [];
  const radius = state.config.boardRadius;

  // Build a set of hole positions for quick lookup
  const holes = state.holes || [];
  const holeSet = new Set(holes.map(hexToKey));

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

      // Check if destination is a hole (can't move to or through holes)
      if (holeSet.has(hexToKey(nextPos))) {
        break; // Holes block movement
      }

      // Check if path is blocked (only need to check for distance > 1)
      // For distance 1, we check if there's a piece at destination
      // For distance 2, we check if there's a piece or hole at the intermediate hex
      if (dist > 1) {
        // Check if the path is clear (intermediate hex has a piece)
        const intermediatePiece = getPieceAt(state, currentPos);
        if (intermediatePiece && intermediatePiece.id !== piece.id) {
          break; // Path is blocked by intermediate piece
        }
        // Holes in path are already checked above when we moved to currentPos
      }

      // Check what's at the destination
      const pieceAtDest = getPieceAt(state, nextPos);

      // Cannot land on friendly pieces
      if (pieceAtDest && pieceAtDest.playerId === playerId) {
        break; // Can't move to or through friendly pieces
      }

      // Warriors cannot enter the Throne
      if (piece.type === 'warrior' && nextPos.q === 0 && nextPos.r === 0) {
        // Continue checking next distance - throne blocks but doesn't stop path
        currentPos = nextPos;
        continue;
      }

      // Determine if this is a move or attack
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
  const validMoves: ValidMove[] = [];

  for (const reachable of reachableHexes) {
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

        // Skip attacks that would be blocked - they waste the turn with no effect
        if (combatPreview.outcome === 'blocked') {
          continue;
        }
      }
    }

    validMoves.push({
      destination: reachable.destination,
      moveType: reachable.moveType,
      hasMomentum: reachable.hasMomentum,
      combatPreview,
    });
  }

  return validMoves;
}

/**
 * Check if a player has any legal moves available.
 * Returns true if any of the player's pieces can move to at least one valid destination.
 *
 * This is used to enforce the no-pass rule: if a player has legal moves, they MUST move.
 * If they have no legal moves (extremely rare - completely boxed in), they may skip their turn.
 *
 * @param state - The current game state
 * @param playerId - The ID of the player to check
 * @returns true if the player has at least one legal move
 */
export function hasLegalMoves(state: GameState, playerId: string): boolean {
  // Get all pieces belonging to this player
  const playerPieces = state.pieces.filter((p) => p.playerId === playerId);

  // Check if any piece has at least one reachable hex
  for (const piece of playerPieces) {
    const reachable = getReachableHexes(state, piece.id);
    if (reachable.length > 0) {
      return true;
    }
  }

  return false;
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

  // Track the move in history
  // Find the actual destination from the MOVE event (handles blocked attacks)
  const moveEvent = events.find((e) => e.type === 'MOVE') as MoveEvent | undefined;
  const actualDestination = moveEvent?.to ?? destination;

  // Find first eliminated piece (for capture tracking)
  const eliminatedEvent = events.find((e) => e.type === 'ELIMINATED' && e.cause === 'edge');
  const capturedPieceId =
    eliminatedEvent?.type === 'ELIMINATED' ? (eliminatedEvent as any).pieceId : undefined;

  // Get player name
  const player = state.players.find((p) => p.id === playerId);

  const historyEntry: MoveHistoryEntry = {
    turnNumber: state.turnNumber,
    playerId: playerId,
    playerName: player?.name ?? playerId,
    pieceId: command.pieceId,
    pieceType: piece.type as 'jarl' | 'warrior',
    from: piece.position,
    to: actualDestination,
    ...(capturedPieceId && { captured: capturedPieceId }),
  };

  resultState = {
    ...resultState,
    moveHistory: [...(state.moveHistory ?? []), historyEntry],
  };

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
  // A round completes when the next player in natural order is the current round's first player
  const activePlayers = resultState.players.filter((p) => !p.isEliminated);
  const currentFirstPlayer = activePlayers[resultState.firstPlayerIndex % activePlayers.length];
  const isNewRound = nextPlayerId === currentFirstPlayer?.id && newTurnNumber > 0;
  const newRoundNumber = isNewRound ? resultState.roundNumber + 1 : resultState.roundNumber;

  // Rotate first player index when a new round starts
  const newFirstPlayerIndex = isNewRound
    ? (resultState.firstPlayerIndex + 1) % activePlayers.length
    : resultState.firstPlayerIndex;

  // When a new round starts, the next player is the new round's first player
  const actualNextPlayerId = isNewRound ? activePlayers[newFirstPlayerIndex].id : nextPlayerId;

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
    currentPlayerId: actualNextPlayerId,
    turnNumber: newTurnNumber,
    roundNumber: newRoundNumber,
    firstPlayerIndex: newFirstPlayerIndex,
    roundsSinceElimination: newRoundsSinceElimination,
  };

  // Add turn ended event
  const turnEndedEvent: TurnEndedEvent = {
    type: 'TURN_ENDED',
    playerId,
    nextPlayerId: actualNextPlayerId,
    turnNumber: newTurnNumber,
  };
  events.push(turnEndedEvent);

  return {
    success: true,
    newState: resultState,
    events,
  };
}
