import { createInitialState, calculateDefense, GameState, Piece } from '../index';

describe('calculateDefense', () => {
  // Shared helper to create a minimal game state for testing
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 0,
        warriorCount: 5,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: 'red', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: 'blue', isEliminated: false },
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

  describe('base strength', () => {
    it('should return base strength 1 for Warrior', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateDefense(state, warrior, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should return base strength 2 for Jarl', () => {
      const jarl: Piece = {
        id: 'j1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([jarl]);
      const result = calculateDefense(state, jarl, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('no momentum for defense', () => {
    it('should always have momentum of 0', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateDefense(state, warrior, { q: 0, r: 0 }, 0);
      expect(result.momentum).toBe(0);
    });

    it('should have momentum 0 for Jarl as well', () => {
      const jarl: Piece = {
        id: 'j1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([jarl]);
      const result = calculateDefense(state, jarl, { q: 0, r: 0 }, 0);
      expect(result.momentum).toBe(0);
    });
  });

  describe('bracing support', () => {
    it('should add strength of friendly piece behind defender', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const bracer: Piece = {
        id: 'bracer',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender, bracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should add Jarl bracing strength of 2', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const jarlBracer: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender, jarlBracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should sum multiple pieces in bracing line', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const bracer1: Piece = {
        id: 'b1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const bracer2: Piece = {
        id: 'b2',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([defender, bracer1, bracer2]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should not count enemy pieces as bracing', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const enemyPiece: Piece = {
        id: 'enemy',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender, enemyPiece]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.support).toBe(0);
      expect(result.total).toBe(1);
    });

    it('should stop at empty hex (bracing line must be continuous)', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const distantBracer: Piece = {
        id: 'bracer',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([defender, distantBracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.support).toBe(0);
      expect(result.total).toBe(1);
    });
  });

  describe('combined defense calculation', () => {
    it('should calculate total with base + bracing (no momentum)', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const bracer: Piece = {
        id: 'bracer',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender, bracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(2);
      expect(result.momentum).toBe(0);
      expect(result.support).toBe(1);
      expect(result.total).toBe(3);
    });

    it('should return correct breakdown structure', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateDefense(state, warrior, { q: 0, r: 0 }, 0);
      expect(result).toHaveProperty('baseStrength');
      expect(result).toHaveProperty('momentum');
      expect(result).toHaveProperty('support');
      expect(result).toHaveProperty('total');
    });

    it('should handle Jarl defending with full bracing', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const jarlBracer: Piece = {
        id: 'jarl2',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const warriorBracer: Piece = {
        id: 'warrior',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([defender, jarlBracer, warriorBracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(2);
      expect(result.momentum).toBe(0);
      expect(result.support).toBe(3);
      expect(result.total).toBe(5);
    });
  });

  describe('different push directions', () => {
    it('should calculate bracing for Northeast push direction', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const bracer: Piece = {
        id: 'bracer',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: -1 },
      };
      const state = createTestState([defender, bracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 1);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should calculate bracing for West push direction', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const bracer: Piece = {
        id: 'bracer',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([defender, bracer]);
      const result = calculateDefense(state, defender, { q: 0, r: 0 }, 3);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('game scenarios', () => {
    it('should work with actual initial game state', () => {
      const state = createInitialState(['Player 1', 'Player 2']);
      const jarl = state.pieces.find(
        (p) => p.type === 'jarl' && p.playerId === state.players[0].id
      );
      expect(jarl).toBeDefined();
      const result = calculateDefense(state, jarl!, jarl!.position, 0);
      expect(result.baseStrength).toBe(2);
      expect(result.momentum).toBe(0);
      expect(typeof result.support).toBe('number');
      expect(result.total).toBe(result.baseStrength + result.support);
    });

    it('should handle defense against attack from behind (shield wall scenario)', () => {
      const frontWarrior: Piece = {
        id: 'front',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const middleWarrior: Piece = {
        id: 'middle',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const backWarrior: Piece = {
        id: 'back',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([frontWarrior, middleWarrior, backWarrior]);
      const result = calculateDefense(state, frontWarrior, { q: 0, r: 0 }, 0);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(3);
    });
  });
});
