import { resolveCompression, GameState, Piece, ChainResult } from '../index';

describe('resolveCompression - edge cases and scenarios', () => {
  // Helper function to create a minimal game state with specific pieces
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        warriorCount: 0,
        turnTimerMs: null,
        terrain: 'calm',
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
      ],
      pieces,
      holes: [],
      currentPlayerId: 'p1',
      turnNumber: 0,
      roundNumber: 0,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
      moveHistory: [],
    };
  }

  describe('error handling', () => {
    it('should throw error if attacker not found', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      expect(() => {
        resolveCompression(
          state,
          'nonexistent-attacker',
          { q: 2, r: 0 },
          { q: 1, r: 0 },
          3,
          false,
          chain
        );
      }).toThrow('Attacker with ID nonexistent-attacker not found');
    });

    it('should throw error if called with edge terminator', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge', // Invalid for compression
        terminatorPosition: { q: 4, r: 0 },
      };

      expect(() => {
        resolveCompression(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, false, chain);
      }).toThrow("resolveCompression called with invalid terminator: edge. Expected 'throne'.");
    });

    it('should throw error if called with empty terminator', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'empty', // Invalid for compression
        terminatorPosition: { q: 2, r: 0 },
      };

      expect(() => {
        resolveCompression(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, false, chain);
      }).toThrow("resolveCompression called with invalid terminator: empty. Expected 'throne'.");
    });

    it('should throw error if called with hole terminator', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'hole', // Invalid for compression - holes cause elimination like edges
        terminatorPosition: { q: 2, r: 0 },
      };

      expect(() => {
        resolveCompression(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, false, chain);
      }).toThrow("resolveCompression called with invalid terminator: hole. Expected 'throne'.");
    });
  });

  describe('different push directions', () => {
    it('should work when compressing West against throne', () => {
      // Pushing West: attacker at q=2, defender at q=1, throne at q=0
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3, // Push West
        true,
        chain
      );

      // When defender can't move, attacker stays at attackerFrom
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 3, r: 0 }); // Stays at attackerFrom

      // Defender cannot enter throne, so no PUSH event
      const pushEvents = result.events.filter((e) => e.type === 'PUSH');
      expect(pushEvents).toHaveLength(0);
    });

    it('should work when compressing East against throne', () => {
      // Pushing East: attacker at q=-2, defender at q=-1, throne at q=0
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: -3, r: 0 },
        { q: -1, r: 0 },
        0, // Push East
        true,
        chain
      );

      // When defender can't move, attacker stays at attackerFrom
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: -3, r: 0 });
    });

    it('should work when compressing Southeast against throne', () => {
      // Pushing Southeast (direction 5): q+0, r+1
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: -2 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: -1 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 0, r: -3 },
        { q: 0, r: -1 },
        5, // Push Southeast
        true,
        chain
      );

      // When defender can't move, attacker stays at attackerFrom
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 0, r: -3 });
    });
  });

  describe('mixed allegiance chains', () => {
    it('should handle chain with both friendly and enemy pieces', () => {
      // Chain: enemy W1 at (-1,0), friendly W2 at (0,0) being pushed toward throne
      // Wait - throne is at (0,0), so we can't have a piece there
      // Let's test a different direction
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 3, r: 0 },
      };
      const enemyW: Piece = {
        id: 'enemy-w',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const friendlyW: Piece = {
        id: 'friendly-w',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, enemyW, friendlyW]);

      const chain: ChainResult = {
        pieces: [enemyW, friendlyW],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        3, // Push West
        false,
        chain
      );

      // No pieces eliminated
      expect(result.newState.pieces).toHaveLength(3);

      // Attacker moves to first defender's position since chain can compress partially
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 2, r: 0 });
    });
  });

  describe('game scenarios', () => {
    it('should handle typical combat scenario with throne blocking', () => {
      // Realistic scenario: Player 1 attacks Player 2's warrior who is adjacent to throne
      const jarl: Piece = {
        id: 'jarl-p1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const warrior: Piece = {
        id: 'w-p2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([jarl, warrior]);

      const chain: ChainResult = {
        pieces: [warrior],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'jarl-p1',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3, // Push West
        true, // Jarl had draft formation
        chain
      );

      // Verify result
      expect(result.newState.pieces).toHaveLength(2);

      // When defender can't move, attacker stays at attackerFrom
      const jarlInNewState = result.newState.pieces.find((p) => p.id === 'jarl-p1');
      expect(jarlInNewState?.position).toEqual({ q: 3, r: 0 });

      // Events should include MOVE for Jarl
      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.pieceId).toBe('jarl-p1');
        expect(moveEvent.hasMomentum).toBe(true);
      }
    });
  });
});
