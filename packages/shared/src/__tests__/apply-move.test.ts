import {
  createInitialState,
  getValidMoves,
  applyMove,
  calculateCombat,
  GameState,
  Piece,
  MoveEvent,
  PushEvent,
} from '../index';

describe('applyMove', () => {
  function createTestState(
    pieces: Piece[],
    options: {
      currentPlayerId?: string;
      phase?: 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';
    } = {}
  ): GameState {
    return {
      id: 'test-game',
      phase: options.phase ?? 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 0,
        warriorCount: 5,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: options.currentPlayerId ?? 'p1',
      turnNumber: 0,
      roundNumber: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('validation', () => {
    it('should return error when move is invalid', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Try to move p2's piece when it's p1's turn
      const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_YOUR_TURN');
      expect(result.newState).toBe(state); // Same state reference
      expect(result.events).toHaveLength(0);
    });

    it('should return error when game is not in playing phase', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces, { phase: 'lobby' });

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(false);
      expect(result.error).toBe('GAME_NOT_PLAYING');
    });

    it('should return error when piece does not exist', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', {
        pieceId: 'nonexistent',
        destination: { q: 2, r: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('PIECE_NOT_FOUND');
    });
  });

  describe('simple move (no combat)', () => {
    it('should move piece to empty hex', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Check piece moved
      const movedPiece = result.newState.pieces.find((p) => p.id === 'p1-jarl');
      expect(movedPiece!.position).toEqual({ q: 2, r: 0 });
    });

    it('should generate MOVE event for simple move', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.pieceId).toBe('p1-jarl');
      expect(moveEvent.from).toEqual({ q: 3, r: 0 });
      expect(moveEvent.to).toEqual({ q: 2, r: 0 });
      expect(moveEvent.hasMomentum).toBe(false);
    });

    it('should set hasMomentum true for 2-hex move', () => {
      // Warrior at (3,0) moves 2 hexes to (1,0) - path is clear
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 3 } }, // Out of the way
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);
      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
      expect(moveEvent.hasMomentum).toBe(true);
    });

    it('should advance turn to next player', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.currentPlayerId).toBe('p2');
      expect(result.newState.turnNumber).toBe(1);
    });

    it('should generate TURN_ENDED event', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      const turnEndedEvent = result.events.find((e) => e.type === 'TURN_ENDED');
      expect(turnEndedEvent).toBeDefined();
      expect((turnEndedEvent as any).playerId).toBe('p1');
      expect((turnEndedEvent as any).nextPlayerId).toBe('p2');
      expect((turnEndedEvent as any).turnNumber).toBe(1);
    });
  });

  describe('attack with push', () => {
    it('should push defender when attack succeeds', () => {
      // Jarl attacking Warrior (2 vs 1 = push)
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // First verify calculateCombat directly works
      const combatResult = calculateCombat(
        state,
        pieces[0], // p1-jarl
        { q: 2, r: 0 }, // attacker position
        pieces[1], // p2-w1
        { q: 1, r: 0 }, // defender position
        3, // West direction
        false // no momentum
      );
      expect(combatResult.attack.total).toBe(2);
      expect(combatResult.defense.total).toBe(1);
      expect(combatResult.outcome).toBe('push');

      // Now test applyMove
      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);

      // Attacker should be at defender's original position
      const attacker = result.newState.pieces.find((p) => p.id === 'p1-jarl');
      expect(attacker!.position).toEqual({ q: 1, r: 0 });

      // Defender should be pushed West
      const defender = result.newState.pieces.find((p) => p.id === 'p2-w1');
      expect(defender!.position).toEqual({ q: 0, r: 0 }); // Pushed to throne (Warriors can be pushed there)
    });

    it('should generate MOVE and PUSH events for successful push', () => {
      // Same setup as above - 2-hex move for momentum
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 3 } }, // Out of the way
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);

      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.pieceId).toBe('p1-w1');

      const pushEvent = result.events.find((e) => e.type === 'PUSH') as PushEvent;
      expect(pushEvent).toBeDefined();
      expect(pushEvent.pieceId).toBe('p2-w1');
      expect(pushEvent.from).toEqual({ q: 1, r: 0 });
      expect(pushEvent.to).toEqual({ q: 0, r: 0 });
    });

    it('should eliminate piece pushed off edge', () => {
      // Warrior at edge, being pushed off
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } }, // On edge
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Attack: 1 (base) + 2 (Jarl support) = 3 vs 1 = push
      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 3, r: 0 } });

      expect(result.success).toBe(true);

      // Defender should be eliminated
      const defender = result.newState.pieces.find((p) => p.id === 'p2-w1');
      expect(defender).toBeUndefined();

      // Check for ELIMINATED event
      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvent).toBeDefined();
      expect((eliminatedEvent as any).pieceId).toBe('p2-w1');
      expect((eliminatedEvent as any).cause).toBe('edge');
    });

    it('should reset roundsSinceElimination when piece is eliminated', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = {
        ...createTestState(pieces),
        roundsSinceElimination: 5,
      };

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 3, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.roundsSinceElimination).toBe(0);
    });
  });

  describe('blocked attack', () => {
    it('should stop attacker adjacent to defender when attack is blocked', () => {
      // Warrior attacking Jarl (1 vs 2 = blocked)
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Attack: 1 (base) vs 2 (Jarl defense) = blocked
      // 2-hex move: from (3,0) to (1,0) would normally end at enemy position
      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);

      // Attacker should stop adjacent to defender
      const attacker = result.newState.pieces.find((p) => p.id === 'p1-w1');
      expect(attacker!.position).toEqual({ q: 2, r: 0 }); // One hex before destination

      // Defender should not move
      const defender = result.newState.pieces.find((p) => p.id === 'p2-jarl');
      expect(defender!.position).toEqual({ q: 1, r: 0 });
    });

    it('should generate only MOVE event when attack is blocked', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);

      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.to).toEqual({ q: 2, r: 0 }); // Stopped adjacent

      // No PUSH event
      const pushEvent = result.events.find((e) => e.type === 'PUSH');
      expect(pushEvent).toBeUndefined();
    });
  });

  describe('win conditions', () => {
    it('should detect throne victory when Jarl moves to throne', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Jarl moves to throne
      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.phase).toBe('ended');
      expect(result.newState.winnerId).toBe('p1');
      expect(result.newState.winCondition).toBe('throne');

      // Check for GAME_ENDED event
      const gameEndedEvent = result.events.find((e) => e.type === 'GAME_ENDED');
      expect(gameEndedEvent).toBeDefined();
      expect((gameEndedEvent as any).winnerId).toBe('p1');
      expect((gameEndedEvent as any).winCondition).toBe('throne');
    });

    it('should not advance turn when game ends', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } });

      expect(result.success).toBe(true);
      // No TURN_ENDED event
      const turnEndedEvent = result.events.find((e) => e.type === 'TURN_ENDED');
      expect(turnEndedEvent).toBeUndefined();
    });

    it('should detect last standing victory when only one Jarl remains', () => {
      // p1's warrior pushes p2's Jarl off edge
      // Attack: 1 (base) + 2 (Jarl support from behind) would only work if Jarl is behind
      // Let's position it properly
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } }, // Support from behind
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } }, // On edge
      ];
      const state = createTestState(pieces);

      // Attack: 1 (warrior) + 2 (Jarl support) = 3 vs 2 (Jarl defense) = push off edge
      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: -3, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.phase).toBe('ended');
      expect(result.newState.winnerId).toBe('p1');
      expect(result.newState.winCondition).toBe('lastStanding');
    });

    it('should eliminate player and their remaining warriors when Jarl dies', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 0, r: -3 } }, // Far away
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: -3, r: 0 } });

      expect(result.success).toBe(true);

      // p2's Jarl should be eliminated
      expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeUndefined();

      // p2's remaining warrior should also be eliminated
      expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeUndefined();

      // p2 should be marked as eliminated
      const p2 = result.newState.players.find((p) => p.id === 'p2');
      expect(p2!.isEliminated).toBe(true);
    });
  });

  describe('turn management', () => {
    it('should skip eliminated players in turn order', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        // p2 is eliminated
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: true },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: false },
        ],
        config: {
          playerCount: 3,
          boardRadius: 5,
          shieldCount: 0,
          warriorCount: 5,
          turnTimerMs: null,
        },
      };
      state.pieces.push({
        id: 'p3-jarl',
        type: 'jarl',
        playerId: 'p3',
        position: { q: -3, r: 0 },
      });

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      // Should skip p2 and go to p3
      expect(result.newState.currentPlayerId).toBe('p3');
    });

    it('should increment round number when turn cycles back to first player', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces, { currentPlayerId: 'p2' });
      state.roundNumber = 5;
      state.turnNumber = 10;

      const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.currentPlayerId).toBe('p1'); // Back to first player
      expect(result.newState.roundNumber).toBe(6); // Round incremented
      expect(result.newState.turnNumber).toBe(11);
    });

    it('should increment roundsSinceElimination on new round without elimination', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces, { currentPlayerId: 'p2' });
      state.roundsSinceElimination = 3;

      const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.roundsSinceElimination).toBe(4);
    });
  });

  describe('state immutability', () => {
    it('should not modify the original state', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const originalPiecePosition = { ...state.pieces[0].position };
      const originalCurrentPlayer = state.currentPlayerId;

      applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      // Original state should be unchanged
      expect(state.pieces[0].position).toEqual(originalPiecePosition);
      expect(state.currentPlayerId).toBe(originalCurrentPlayer);
    });
  });

  describe('game scenarios', () => {
    it('should handle realistic game state', () => {
      const state = createInitialState(['Alice', 'Bob']);
      state.phase = 'playing';

      // Find a warrior for p1
      const p1Warrior = state.pieces.find(
        (p) => p.type === 'warrior' && p.playerId === state.players[0].id
      );
      expect(p1Warrior).toBeDefined();

      // Get valid moves for this warrior
      const validMoves = getValidMoves(state, p1Warrior!.id);
      expect(validMoves.length).toBeGreaterThan(0);

      // Apply the first valid move
      const result = applyMove(state, state.players[0].id, {
        pieceId: p1Warrior!.id,
        destination: validMoves[0].destination,
      });

      expect(result.success).toBe(true);
      expect(result.newState.currentPlayerId).toBe(state.players[1].id);
    });
  });
});
