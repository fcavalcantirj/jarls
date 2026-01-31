import { HexDirection, createInitialState, calculateAttack, GameState, Piece } from '../index';

describe('calculateAttack', () => {
  // Shared helper to create a minimal game state for testing
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        terrain: 'calm',
        warriorCount: 5,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: 'red', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: 'blue', isEliminated: false },
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

  describe('base strength', () => {
    it('should return base strength 1 for Warrior', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateAttack(state, warrior, { q: 0, r: 0 }, 0, false);
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
      const result = calculateAttack(state, jarl, { q: 0, r: 0 }, 0, false);
      expect(result.baseStrength).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('momentum bonus', () => {
    it('should add +1 momentum when hasMomentum is true', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateAttack(state, warrior, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(1);
      expect(result.momentum).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should not add momentum when hasMomentum is false', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateAttack(state, warrior, { q: 0, r: 0 }, 0, false);
      expect(result.momentum).toBe(0);
    });

    it('should give Warrior total attack of 2 when moving 2 hexes', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateAttack(state, warrior, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(1);
      expect(result.momentum).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should give Jarl total attack of 3 with momentum', () => {
      const jarl: Piece = {
        id: 'j1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([jarl]);
      const result = calculateAttack(state, jarl, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(2);
      expect(result.momentum).toBe(1);
      expect(result.total).toBe(3);
    });
  });

  describe('inline support', () => {
    it('should add strength of friendly piece behind attacker', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const supporter: Piece = {
        id: 'supporter',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, supporter]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, false);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should add Jarl support strength of 2', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const jarlSupporter: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, jarlSupporter]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, false);
      expect(result.baseStrength).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should sum multiple pieces in support line', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const supporter1: Piece = {
        id: 's1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const supporter2: Piece = {
        id: 's2',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const state = createTestState([attacker, supporter1, supporter2]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, false);
      expect(result.support).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should not count enemy pieces as support', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const enemy: Piece = {
        id: 'enemy',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, enemy]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, false);
      expect(result.support).toBe(0);
      expect(result.total).toBe(1);
    });
  });

  describe('combined attack calculation', () => {
    it('should calculate total with base + momentum + support', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const jarlSupport: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const warriorSupport: Piece = {
        id: 'warrior',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const state = createTestState([attacker, jarlSupport, warriorSupport]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(1);
      expect(result.momentum).toBe(1);
      expect(result.support).toBe(3);
      expect(result.total).toBe(5);
    });

    it('should return correct breakdown structure', () => {
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([warrior]);
      const result = calculateAttack(state, warrior, { q: 0, r: 0 }, 0, false);
      expect(result).toHaveProperty('baseStrength');
      expect(result).toHaveProperty('momentum');
      expect(result).toHaveProperty('support');
      expect(result).toHaveProperty('total');
    });

    it('should handle Jarl attacking with full support and momentum', () => {
      const attacker: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const support1: Piece = {
        id: 's1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const support2: Piece = {
        id: 's2',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const state = createTestState([attacker, support1, support2]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(2);
      expect(result.momentum).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(5);
    });
  });

  describe('different attack directions', () => {
    it('should calculate support for Northeast attack direction', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const supporter: Piece = {
        id: 'supporter',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 1 },
      };
      const state = createTestState([attacker, supporter]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 1, false);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should calculate support for West attack direction', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const supporter: Piece = {
        id: 'supporter',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, supporter]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 3, false);
      expect(result.support).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  describe('game scenarios', () => {
    it('should work with actual initial game state', () => {
      const state = createInitialState(['Player 1', 'Player 2']);
      state.phase = 'playing';
      const warrior = state.pieces.find(
        (p) => p.type === 'warrior' && p.playerId === state.currentPlayerId
      );
      expect(warrior).toBeDefined();
      if (!warrior) return;
      for (let d = 0; d < 6; d++) {
        const result = calculateAttack(state, warrior, warrior.position, d as HexDirection, false);
        expect(result.baseStrength).toBe(1);
        expect(result.momentum).toBe(0);
        expect(result.support).toBeGreaterThanOrEqual(0);
        expect(result.total).toBeGreaterThanOrEqual(1);
      }
    });

    it('should handle attacker position different from piece current position', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const supporter: Piece = {
        id: 'supporter',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker, supporter]);
      const result = calculateAttack(state, attacker, { q: 0, r: 0 }, 0, true);
      expect(result.baseStrength).toBe(1);
      expect(result.momentum).toBe(1);
      expect(result.support).toBe(2);
      expect(result.total).toBe(4);
    });
  });
});
