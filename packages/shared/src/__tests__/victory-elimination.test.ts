import { eliminatePlayer, GameState, Piece } from '../index';

describe('eliminatePlayer', () => {
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 0,
        warriorCount: 0,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 1,
      roundNumber: 1,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('marks player as eliminated', () => {
    it('should mark the specified player as eliminated', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.newState.players[0].isEliminated).toBe(true);
      expect(result.newState.players[1].isEliminated).toBe(false);
    });

    it('should mark player 2 as eliminated', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p2');

      expect(result.newState.players[0].isEliminated).toBe(false);
      expect(result.newState.players[1].isEliminated).toBe(true);
    });
  });

  describe('removes all remaining Warriors', () => {
    it('should remove all Warriors belonging to eliminated player', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'p1-w3', type: 'warrior', playerId: 'p1', position: { q: 2, r: -1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      // P1's warriors should be removed
      expect(result.newState.pieces.find((p) => p.id === 'p1-w1')).toBeUndefined();
      expect(result.newState.pieces.find((p) => p.id === 'p1-w2')).toBeUndefined();
      expect(result.newState.pieces.find((p) => p.id === 'p1-w3')).toBeUndefined();
      // P2's pieces should remain
      expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeDefined();
    });

    it('should return removed piece IDs in result', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.removedPieceIds).toHaveLength(2);
      expect(result.removedPieceIds).toContain('p1-w1');
      expect(result.removedPieceIds).toContain('p1-w2');
    });

    it('should handle player with no remaining Warriors', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.removedPieceIds).toHaveLength(0);
      expect(result.newState.players[0].isEliminated).toBe(true);
    });
  });

  describe('generates ELIMINATED events', () => {
    it('should generate ELIMINATED event for each removed Warrior', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.events).toHaveLength(2);
      expect(result.events.every((e) => e.type === 'ELIMINATED')).toBe(true);
    });

    it('should include correct pieceId, playerId, and position in events', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.events).toHaveLength(1);
      const event = result.events[0];
      expect(event.type).toBe('ELIMINATED');
      if (event.type === 'ELIMINATED') {
        expect(event.pieceId).toBe('p1-w1');
        expect(event.playerId).toBe('p1');
        expect(event.position).toEqual({ q: 1, r: 0 });
        expect(event.cause).toBe('starvation');
      }
    });

    it('should generate no events when player has no Warriors', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result.events).toHaveLength(0);
    });
  });

  describe('player cannot take further turns', () => {
    it('should mark player as eliminated so they cannot take turns', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      // The isEliminated flag prevents the player from taking turns
      // (this is enforced by the turn logic, not this function)
      expect(result.newState.players[0].isEliminated).toBe(true);
    });
  });

  describe('handles edge cases', () => {
    it('should return unchanged state when player not found', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'nonexistent-player');

      expect(result.newState).toEqual(state);
      expect(result.events).toHaveLength(0);
      expect(result.removedPieceIds).toHaveLength(0);
    });

    it('should return unchanged state when player already eliminated', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
        ],
      };

      const result = eliminatePlayer(state, 'p1');

      expect(result.newState).toEqual(state);
      expect(result.events).toHaveLength(0);
      expect(result.removedPieceIds).toHaveLength(0);
    });

    it('should not modify original state (immutability)', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const originalPlayerCount = state.players.length;
      const originalPieceCount = state.pieces.length;
      const originalP1Eliminated = state.players[0].isEliminated;

      eliminatePlayer(state, 'p1');

      // Original state should be unchanged
      expect(state.players).toHaveLength(originalPlayerCount);
      expect(state.pieces).toHaveLength(originalPieceCount);
      expect(state.players[0].isEliminated).toBe(originalP1Eliminated);
    });
  });

  describe('does not remove shields', () => {
    it('should not remove shields when eliminating player', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'shield-1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        { id: 'shield-2', type: 'shield', playerId: null, position: { q: 0, r: -1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      // Shields should remain
      expect(result.newState.pieces.find((p) => p.id === 'shield-1')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'shield-2')).toBeDefined();
    });
  });

  describe('preserves other players pieces', () => {
    it('should preserve all pieces belonging to other players', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 1 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      // P2's pieces should all remain
      expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'p2-w2')).toBeDefined();
      // Total pieces should be P2's pieces only
      expect(result.newState.pieces).toHaveLength(3);
    });
  });

  describe('multi-player scenarios', () => {
    it('should work correctly with 3 players', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p3-jarl', type: 'jarl', playerId: 'p3', position: { q: 0, r: 2 } },
        { id: 'p3-w1', type: 'warrior', playerId: 'p3', position: { q: 1, r: 1 } },
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: false },
        ],
      };

      const result = eliminatePlayer(state, 'p1');

      // P1 eliminated
      expect(result.newState.players[0].isEliminated).toBe(true);
      // P2 and P3 still active
      expect(result.newState.players[1].isEliminated).toBe(false);
      expect(result.newState.players[2].isEliminated).toBe(false);
      // P1's warrior removed
      expect(result.newState.pieces.find((p) => p.id === 'p1-w1')).toBeUndefined();
      // Others' pieces remain
      expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'p3-jarl')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'p3-w1')).toBeDefined();
    });
  });

  describe('result structure', () => {
    it('should return correct structure with all fields', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = eliminatePlayer(state, 'p1');

      expect(result).toHaveProperty('newState');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('removedPieceIds');
      expect(Array.isArray(result.events)).toBe(true);
      expect(Array.isArray(result.removedPieceIds)).toBe(true);
    });
  });
});
