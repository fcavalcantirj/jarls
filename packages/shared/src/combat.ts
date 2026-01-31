// Combat calculation and push resolution functions
// Core combat calculations (calculateAttack, calculateDefense, calculateCombat)
// are in combat-core.ts. This file contains push resolution functions.

import type {
  AxialCoord,
  HexDirection,
  Piece,
  GameState,
  GameEvent,
  MoveEvent,
  PushEvent,
  EliminatedEvent,
  SimplePushResult,
  ChainResult,
  EdgePushResult,
  CompressionResult,
  PushResult,
} from './types.js';

import { getNeighborAxial, isOnBoardAxial, hexToKey } from './hex.js';

// Re-export core combat functions from combat-core.ts
export {
  getPieceAt,
  getPieceById,
  getPieceStrength,
  findInlineSupport,
  findBracing,
  calculateAttack,
  calculateDefense,
  calculateCombat,
} from './combat-core.js';

// Import functions we need internally from combat-core
import { getPieceAt, getPieceById } from './combat-core.js';

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

  // Build a set of hole positions for quick lookup
  const holes = state.holes || [];
  const holeSet = new Set(holes.map(hexToKey));

  // Walk in the push direction, collecting pieces until we hit a terminator
  while (true) {
    const pieceAtCurrent = getPieceAt(state, currentPos);

    // If there's a piece at the current position, add it to chain
    if (pieceAtCurrent) {
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

    // Check if next position is a hole - pieces fall into holes and are eliminated
    if (holeSet.has(hexToKey(nextPos))) {
      return {
        pieces,
        terminator: 'hole',
        terminatorPosition: nextPos,
      };
    }

    // Check if next position is the Throne (0,0) and the last piece in the chain
    // is a Warrior. Warriors cannot enter the Throne — it acts as a compression
    // point. Jarls CAN be pushed onto the Throne (they just don't win from being pushed).
    const lastPieceInChain = pieces[pieces.length - 1];
    if (
      nextPos.q === 0 &&
      nextPos.r === 0 &&
      lastPieceInChain &&
      lastPieceInChain.type === 'warrior'
    ) {
      return {
        pieces,
        terminator: 'throne',
        terminatorPosition: nextPos,
      };
    }

    currentPos = nextPos;
  }
}

/**
 * Resolve a push where the chain terminates at the board edge or a hole.
 * The last piece in the chain is eliminated (pushed off the board or into a hole).
 * The chain compresses toward the terminator, with pieces filling in positions
 * from those that were eliminated.
 *
 * Example: If pieces A, B, C are in a chain being pushed toward the edge/hole,
 * and C is at the edge/hole, then C is eliminated, B moves to C's position,
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

  // Validate chain terminator is edge or hole
  if (chain.terminator !== 'edge' && chain.terminator !== 'hole') {
    throw new Error(
      `resolveEdgePush called with invalid terminator: ${chain.terminator}. Expected 'edge' or 'hole'.`
    );
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
  // Use the chain terminator as the cause ('edge' or 'hole')
  const eliminatedEvent: EliminatedEvent = {
    type: 'ELIMINATED',
    pieceId: lastPiece.id,
    playerId: lastPiece.playerId,
    position: lastPosition,
    cause: chain.terminator as 'edge' | 'hole',
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
 * Resolve a push where the chain compresses against the throne.
 * Unlike edge/hole pushes, compression does not eliminate any pieces - they simply
 * compress against the immovable blocker.
 *
 * The resolution:
 * 1. Chain pieces don't actually move (they're already adjacent to the blocker)
 * 2. Attacker takes the first defender's position
 * 3. No pieces are eliminated
 *
 * This handles throne blocking: Warriors compress against throne (they can't enter).
 * Jarls also compress against throne when pushed (can't be pushed onto it).
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

  // Validate chain terminator is throne
  if (chain.terminator !== 'throne') {
    throw new Error(
      `resolveCompression called with invalid terminator: ${chain.terminator}. Expected 'throne'.`
    );
  }

  // Build a list of positions in the chain, from defender position toward blocker
  const chainPositions: AxialCoord[] = [];
  let pos = defenderPosition;
  for (let i = 0; i < chain.pieces.length; i++) {
    chainPositions.push(pos);
    if (i < chain.pieces.length - 1) {
      pos = getNeighborAxial(pos, pushDirection);
    }
  }

  // New positions for chain pieces - each shifts one toward blocker
  const newPositions = new Map<string, AxialCoord>();

  // Track if the defender (first piece) moved - only then can attacker take their spot
  let defenderMoved = false;

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

      // Track if the first piece (defender) moved
      if (i === 0) {
        defenderMoved = true;
      }

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

  // Determine attacker's final position
  // Attacker only moves to defender's position if defender actually moved (made room)
  // If defender couldn't move (adjacent to blocker), attacker stays at attackerFrom
  const attackerDestination = defenderMoved ? defenderPosition : attackerFrom;

  // Always set attacker position explicitly to ensure consistency
  newPositions.set(attacker.id, attackerDestination);

  // Create MOVE event for attacker (insert at beginning for proper event ordering)
  const moveEvent: MoveEvent = {
    type: 'MOVE',
    pieceId: attacker.id,
    from: attackerFrom,
    to: attackerDestination,
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

  return { newState, events };
}

/**
 * Main push resolver that handles all push scenarios.
 *
 * This function orchestrates push resolution by:
 * 1. Detecting the chain of pieces that will be affected
 * 2. Determining the chain terminator (edge, hole, throne, or empty)
 * 3. Routing to the appropriate resolution function
 *
 * Chain terminators and their resolutions:
 * - empty: Chain push - all pieces shift one position in push direction
 * - edge: Edge elimination - pieces pushed off board are eliminated (resolveEdgePush)
 * - hole: Hole elimination - pieces pushed into holes are eliminated (resolveEdgePush)
 * - throne: Compression - pieces compress against throne (resolveCompression)
 *
 * Events are generated with correct depth values for staggered animation:
 * - MOVE event for attacker (depth implicit)
 * - PUSH events for each chain piece with increasing depth
 * - ELIMINATED events for pieces pushed off edge or into holes
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

    case 'edge':
    case 'hole': {
      // Edge/hole elimination - pieces pushed off board or into hole are eliminated
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

    case 'throne': {
      // Compression - pieces compress against throne (warriors can't enter)
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
