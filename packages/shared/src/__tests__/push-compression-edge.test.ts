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
        shieldCount: 0,
        warriorCount: 0,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 0,
      roundNumber: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
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
      const shield: Piece = {
        id: 'shield1',
        type: 'shield',
        playerId: null,
        position: { q: 2, r: 0 },
      };
      const state = createTestState([defender, shield]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'shield',
        terminatorPosition: { q: 2, r: 0 },
      };

      expect(() => {
        resolveCompression(
          state,
          'nonexistent-attacker',
          { q: 0, r: 0 },
          { q: 1, r: 0 },
          0,
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
      }).toThrow(
        "resolveCompression called with invalid terminator: edge. Expected 'shield' or 'throne'."
      );
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
      }).toThrow(
        "resolveCompression called with invalid terminator: empty. Expected 'shield' or 'throne'."
      );
    });
  });

  describe('different push directions', () => {
    it('should work when compressing West against shield', () => {
      // Pushing West: attacker at q=1, defender at q=0, shield at q=-1
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const shield: Piece = {
        id: 'shield1',
        type: 'shield',
        playerId: null,
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, defender, shield]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'shield',
        terminatorPosition: { q: -1, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 2, r: 0 },
        { q: 0, r: 0 },
        3, // Push West
        true,
        chain
      );

      // Attacker moves to defender's position
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 0, r: 0 });
    });

    it('should work when compressing West against throne', () => {
      // Pushing West: attacker at q=2, defender at q=1,r=0, throne at q=0,r=0
      // Direction 3 (West): q-1, r+0 → defender at (1,0) pushed West goes to (0,0) = throne
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
        false,
        chain
      );

      // Attacker moves to defender's position
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 1, r: 0 });

      // Defender cannot enter throne, so no PUSH event
      const pushEvents = result.events.filter((e) => e.type === 'PUSH');
      expect(pushEvents).toHaveLength(0);
    });

    it('should work when compressing Southeast against shield', () => {
      // Pushing Southeast (direction 5): q+0, r+1, s-1
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: -1 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const shield: Piece = {
        id: 'shield1',
        type: 'shield',
        playerId: null,
        position: { q: 0, r: 1 },
      };
      const state = createTestState([attacker, defender, shield]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'shield',
        terminatorPosition: { q: 0, r: 1 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 0, r: -2 },
        { q: 0, r: 0 },
        5, // Push Southeast
        true,
        chain
      );

      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 0, r: 0 });
    });
  });

  describe('mixed allegiance chains', () => {
    it('should handle chain with both friendly and enemy pieces', () => {
      // Chain: enemy W1, friendly W2, shield
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const enemyW: Piece = {
        id: 'enemy-w',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const friendlyW: Piece = {
        id: 'friendly-w',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const shield: Piece = {
        id: 'shield1',
        type: 'shield',
        playerId: null,
        position: { q: 2, r: 0 },
      };
      const state = createTestState([attacker, enemyW, friendlyW, shield]);

      const chain: ChainResult = {
        pieces: [enemyW, friendlyW],
        terminator: 'shield',
        terminatorPosition: { q: 2, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0,
        false,
        chain
      );

      // No pieces eliminated
      expect(result.newState.pieces).toHaveLength(4);

      // Attacker takes first defender's position
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 0, r: 0 });
    });
  });

  describe('game scenarios', () => {
    it('should handle typical combat scenario with shield blocking', () => {
      // Realistic scenario: Player 1 attacks Player 2's warrior who is backed by a shield
      const jarl: Piece = {
        id: 'jarl-p1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const warrior: Piece = {
        id: 'w-p2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const shield: Piece = {
        id: 'shield1',
        type: 'shield',
        playerId: null,
        position: { q: 1, r: 0 },
      };
      const state = createTestState([jarl, warrior, shield]);

      const chain: ChainResult = {
        pieces: [warrior],
        terminator: 'shield',
        terminatorPosition: { q: 1, r: 0 },
      };

      const result = resolveCompression(
        state,
        'jarl-p1',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0,
        true, // Jarl had draft formation
        chain
      );

      // Verify result
      expect(result.newState.pieces).toHaveLength(3);

      const jarlInNewState = result.newState.pieces.find((p) => p.id === 'jarl-p1');
      expect(jarlInNewState?.position).toEqual({ q: 0, r: 0 });

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
