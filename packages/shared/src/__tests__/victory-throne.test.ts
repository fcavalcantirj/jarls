import { checkThroneVictory, AxialCoord, GameState, Piece } from '../index';

describe('checkThroneVictory', () => {
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
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 1,
      roundNumber: 1,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('returns victory when Jarl voluntarily moves onto Throne', () => {
    it('should return victory when Jarl is on throne and move was voluntary', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 }, // On throne
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });

    it('should return victory for player 2 Jarl', () => {
      const jarl: Piece = {
        id: 'jarl-2',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 0, r: 0 }, // On throne
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-2', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
    });
  });

  describe('returns no victory for pushed Jarl (involuntary move)', () => {
    it('should return no victory when move was not voluntary', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 }, // On throne
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', false);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('returns no victory when Jarl is not on Throne', () => {
    it('should return no victory when Jarl is at (1, 0)', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 1, r: 0 }, // Adjacent to throne
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory when Jarl is at edge', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 3, r: 0 }, // Edge position
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory when Jarl is at negative coordinates', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -2, r: 1 },
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('returns no victory for non-Jarl pieces', () => {
    it('should return no victory when Warrior is on throne (hypothetically)', () => {
      const warrior: Piece = {
        id: 'warrior-1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 }, // On throne (shouldn't happen in game)
      };
      const state = createTestState([warrior]);

      const result = checkThroneVictory(state, 'warrior-1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory when Shield is on throne (hypothetically)', () => {
      const shield: Piece = {
        id: 'shield-1',
        type: 'shield',
        playerId: null,
        position: { q: 0, r: 0 }, // On throne (shouldn't happen in game)
      };
      const state = createTestState([shield]);

      const result = checkThroneVictory(state, 'shield-1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('returns no victory when piece is not found', () => {
    it('should return no victory when piece ID does not exist', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'non-existent-id', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory with empty pieces array', () => {
      const state = createTestState([]);

      const result = checkThroneVictory(state, 'any-id', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('result structure', () => {
    it('should return correct structure for victory', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(typeof result.isVictory).toBe('boolean');
      expect(typeof result.winnerId).toBe('string');
    });

    it('should return correct structure for no victory', () => {
      const jarl: Piece = {
        id: 'jarl-1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 1, r: 0 }, // Not on throne
      };
      const state = createTestState([jarl]);

      const result = checkThroneVictory(state, 'jarl-1', true);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(typeof result.isVictory).toBe('boolean');
      expect(result.winnerId).toBeNull();
    });
  });

  describe('game scenarios', () => {
    it('should detect victory in a realistic game state', () => {
      // Game where Jarl has just moved to throne
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 2 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 1 } },
        { id: 'shield-1', type: 'shield', playerId: null, position: { q: 2, r: -1 } },
      ];
      const state = createTestState(pieces);

      const result = checkThroneVictory(state, 'p1-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });

    it('should not trigger victory when other Jarl moves', () => {
      // Game where P1 Jarl is on throne but P2 just moved
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 2 } },
      ];
      const state = createTestState(pieces);

      // P2 Jarl moved, not P1 Jarl
      const result = checkThroneVictory(state, 'p2-jarl', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should correctly identify winning player ID', () => {
      const jarl: Piece = {
        id: 'jarl-special',
        type: 'jarl',
        playerId: 'player-abc-123',
        position: { q: 0, r: 0 },
      };
      const state: GameState = {
        ...createTestState([jarl]),
        players: [
          { id: 'player-abc-123', name: 'Alice', color: '#ff0000', isEliminated: false },
          { id: 'player-xyz-456', name: 'Bob', color: '#0000ff', isEliminated: false },
        ],
      };

      const result = checkThroneVictory(state, 'jarl-special', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('player-abc-123');
    });
  });

  describe('throne position verification', () => {
    it('should only recognize (0, 0) as throne', () => {
      // Test that slight offsets don't count as throne
      const nearbyPositions: AxialCoord[] = [
        { q: 1, r: 0 },
        { q: -1, r: 0 },
        { q: 0, r: 1 },
        { q: 0, r: -1 },
        { q: 1, r: -1 },
        { q: -1, r: 1 },
      ];

      for (const pos of nearbyPositions) {
        const jarl: Piece = {
          id: 'jarl-1',
          type: 'jarl',
          playerId: 'p1',
          position: pos,
        };
        const state = createTestState([jarl]);

        const result = checkThroneVictory(state, 'jarl-1', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      }
    });
  });
});
