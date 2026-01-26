// Combat calculation and push resolution functions

import type {
  AxialCoord,
  HexDirection,
  Piece,
  GameState,
  CombatBreakdown,
  CombatResult,
  GameEvent,
  MoveEvent,
  PushEvent,
  EliminatedEvent,
  InlineSupportResult,
  BracingResult,
  SimplePushResult,
  ChainResult,
  EdgePushResult,
  CompressionResult,
  PushResult,
} from './types.js';

import {
  axialToCube,
  cubeToAxial,
  getNeighbor,
  getNeighborAxial,
  getOppositeDirection,
  isOnBoard,
  isOnBoardAxial,
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
