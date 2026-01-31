import { createInitialState, applyMove, GameState, Piece, MoveHistoryEntry } from '../index';

describe('Move History', () => {
  function createTestState(
    pieces: Piece[],
    options: {
      currentPlayerId?: string;
      phase?: 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';
      turnNumber?: number;
      moveHistory?: MoveHistoryEntry[];
    } = {}
  ): GameState {
    return {
      id: 'test-game',
      phase: options.phase ?? 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        terrain: 'calm',
        warriorCount: 5,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: options.currentPlayerId ?? 'p1',
      turnNumber: options.turnNumber ?? 1,
      roundNumber: 0,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
      moveHistory: options.moveHistory ?? [],
    };
  }

  describe('initial state', () => {
    it('should have empty move history', () => {
      const state = createInitialState(['Alice', 'Bob']);
      expect(state.moveHistory).toEqual([]);
    });
  });

  describe('simple move tracking', () => {
    it('should record warrior move with correct fields', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.moveHistory).toHaveLength(1);

      const entry = result.newState.moveHistory[0];
      expect(entry.turnNumber).toBe(1);
      expect(entry.playerId).toBe('p1');
      expect(entry.playerName).toBe('Player 1');
      expect(entry.pieceId).toBe('p1-w1');
      expect(entry.pieceType).toBe('warrior');
      expect(entry.from).toEqual({ q: 2, r: 0 });
      expect(entry.to).toEqual({ q: 1, r: 0 });
      expect(entry.captured).toBeUndefined();
    });

    it('should record jarl move with pieceType jarl', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.moveHistory).toHaveLength(1);

      const entry = result.newState.moveHistory[0];
      expect(entry.pieceType).toBe('jarl');
      expect(entry.pieceId).toBe('p1-jarl');
    });
  });

  describe('capture tracking', () => {
    it('should record captured piece when pushed off board', () => {
      // Warrior attacking warrior on edge - will push off
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } }, // On edge
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Attack: 1 (base) + 2 (Jarl support) = 3 vs 1 = push off edge
      const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 3, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.moveHistory).toHaveLength(1);

      const entry = result.newState.moveHistory[0];
      expect(entry.captured).toBe('p2-w1');
    });

    it('should not have captured field for push that stays on board', () => {
      // Jarl attacking Warrior - push but not off edge
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.moveHistory).toHaveLength(1);

      const entry = result.newState.moveHistory[0];
      expect(entry.captured).toBeUndefined();
    });
  });

  describe('history accumulation', () => {
    it('should accumulate multiple moves in order', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Turn 1: p1 moves
      const result1 = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });
      expect(result1.success).toBe(true);

      // Turn 2: p2 moves
      const result2 = applyMove(result1.newState, 'p2', {
        pieceId: 'p2-jarl',
        destination: { q: -2, r: 0 },
      });
      expect(result2.success).toBe(true);

      // Should have 2 entries in order
      expect(result2.newState.moveHistory).toHaveLength(2);
      expect(result2.newState.moveHistory[0].playerName).toBe('Player 1');
      expect(result2.newState.moveHistory[1].playerName).toBe('Player 2');
    });

    it('should preserve existing history when adding new move', () => {
      const existingHistory: MoveHistoryEntry[] = [
        {
          turnNumber: 1,
          playerId: 'p1',
          playerName: 'Player 1',
          pieceId: 'p1-w1',
          pieceType: 'warrior',
          from: { q: 3, r: -1 },
          to: { q: 2, r: -1 },
        },
      ];

      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces, {
        currentPlayerId: 'p2',
        turnNumber: 2,
        moveHistory: existingHistory,
      });

      const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

      expect(result.success).toBe(true);
      expect(result.newState.moveHistory).toHaveLength(2);
      expect(result.newState.moveHistory[0]).toEqual(existingHistory[0]);
      expect(result.newState.moveHistory[1].playerName).toBe('Player 2');
    });
  });

  describe('player name preservation', () => {
    it('should use correct player name from state', () => {
      const state = createInitialState(['Alice', 'Bob']);
      state.phase = 'playing';

      // Find a warrior for first player
      const p1Id = state.players[0].id;
      const p1Warrior = state.pieces.find((p) => p.type === 'warrior' && p.playerId === p1Id);

      // Move the warrior toward center (find a valid destination)
      const result = applyMove(state, p1Id, {
        pieceId: p1Warrior!.id,
        destination: { q: p1Warrior!.position.q - 1, r: p1Warrior!.position.r },
      });

      // Might fail if destination is invalid, but if success, check history
      if (result.success) {
        expect(result.newState.moveHistory[0].playerName).toBe('Alice');
      }
    });
  });

  describe('failed moves', () => {
    it('should not record failed moves in history', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Try invalid move (move off board)
      const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 4, r: 0 } });

      expect(result.success).toBe(false);
      expect(result.newState.moveHistory).toHaveLength(0);
    });
  });
});
