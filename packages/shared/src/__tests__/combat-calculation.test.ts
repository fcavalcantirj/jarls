import {
  HexDirection,
  createInitialState,
  calculateAttack,
  calculateDefense,
  calculateCombat,
  GameState,
  Piece,
} from '../index';

describe('Combat Calculation', () => {
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

  describe('calculateAttack', () => {
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
          const result = calculateAttack(
            state,
            warrior,
            warrior.position,
            d as HexDirection,
            false
          );
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

  describe('calculateDefense', () => {
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

  describe('calculateCombat', () => {
    describe('returns attack and defense values', () => {
      it('should return attack breakdown with all components', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          false
        );
        expect(result.attack).toHaveProperty('baseStrength');
        expect(result.attack).toHaveProperty('momentum');
        expect(result.attack).toHaveProperty('support');
        expect(result.attack).toHaveProperty('total');
        expect(result.attack.baseStrength).toBe(1);
        expect(result.attack.momentum).toBe(0);
      });

      it('should return defense breakdown with all components', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          false
        );
        expect(result.defense).toHaveProperty('baseStrength');
        expect(result.defense).toHaveProperty('momentum');
        expect(result.defense).toHaveProperty('support');
        expect(result.defense).toHaveProperty('total');
        expect(result.defense.baseStrength).toBe(1);
        expect(result.defense.momentum).toBe(0);
      });
    });

    describe('returns attack/defense breakdowns', () => {
      it('should include attack support from pieces behind attacker', () => {
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
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, supporter, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          false
        );
        expect(result.attack.support).toBe(1);
        expect(result.attack.total).toBe(2);
      });

      it('should include defense bracing from pieces behind defender', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const bracer: Piece = {
          id: 'bracer',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender, bracer]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.defense.support).toBe(1);
        expect(result.defense.total).toBe(2);
      });

      it('should include momentum bonus in attack breakdown', () => {
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
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          true
        );
        expect(result.attack.momentum).toBe(1);
        expect(result.attack.total).toBe(2);
      });
    });

    describe('returns outcome (push or blocked)', () => {
      it('should return push when attack > defense', () => {
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
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          true
        );
        expect(result.attack.total).toBe(2);
        expect(result.defense.total).toBe(1);
        expect(result.outcome).toBe('push');
      });

      it('should return blocked when attack < defense', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const bracer: Piece = {
          id: 'bracer',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, defender, bracer]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(1);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('blocked');
      });

      it('should return blocked when attack equals defense', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(1);
        expect(result.defense.total).toBe(1);
        expect(result.outcome).toBe('blocked');
      });

      it('should return push when Jarl attacks Warrior without support', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(2);
        expect(result.defense.total).toBe(1);
        expect(result.outcome).toBe('push');
      });

      it('should return blocked when Warrior attacks Jarl without momentum', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'jarl',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(1);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('blocked');
      });

      it('should return blocked when Warrior with momentum attacks Jarl (equal power)', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 1 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'jarl',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          true
        );
        expect(result.attack.total).toBe(2);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('blocked');
      });
    });

    describe('push direction', () => {
      it('should return pushDirection when outcome is push', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.outcome).toBe('push');
        expect(result.pushDirection).toBe(0);
      });

      it('should return null pushDirection when outcome is blocked', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.outcome).toBe('blocked');
        expect(result.pushDirection).toBeNull();
      });

      it('should return correct pushDirection for different attack directions', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: 0, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: -1 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: -1 },
          1,
          false
        );
        expect(result.outcome).toBe('push');
        expect(result.pushDirection).toBe(1);
      });
    });

    describe('includes attacker and defender IDs', () => {
      it('should return correct attackerId and defenderId', () => {
        const attacker: Piece = {
          id: 'att-123',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'def-456',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attackerId).toBe('att-123');
        expect(result.defenderId).toBe('def-456');
      });
    });

    describe('used for combat preview', () => {
      it('should provide all information needed for combat preview UI', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: -2, r: 0 },
        };
        const attackerSupport: Piece = {
          id: 'supporter',
          type: 'warrior',
          playerId: 'p1',
          position: { q: -3, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const defenderBracer: Piece = {
          id: 'bracer',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, attackerSupport, defender, defenderBracer]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          true
        );
        expect(result.attackerId).toBeDefined();
        expect(result.defenderId).toBeDefined();
        expect(result.attack.baseStrength).toBe(2);
        expect(result.attack.momentum).toBe(1);
        expect(result.attack.support).toBeGreaterThanOrEqual(0);
        expect(result.defense.baseStrength).toBe(1);
        expect(result.defense.momentum).toBe(0);
        expect(result.defense.support).toBe(1);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('push');
        expect(result.pushDirection).toBe(0);
      });

      it('should work with actual game state', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.phase = 'playing';
        const player1Warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.players[0].id
        );
        const player2Warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.players[1].id
        );
        expect(player1Warrior).toBeDefined();
        expect(player2Warrior).toBeDefined();
        if (!player1Warrior || !player2Warrior) return;
        const result = calculateCombat(
          state,
          player1Warrior,
          player1Warrior.position,
          player2Warrior,
          player2Warrior.position,
          0,
          false
        );
        expect(result).toHaveProperty('attackerId');
        expect(result).toHaveProperty('defenderId');
        expect(result).toHaveProperty('attack');
        expect(result).toHaveProperty('defense');
        expect(result).toHaveProperty('outcome');
        expect(result).toHaveProperty('pushDirection');
        expect(['push', 'blocked']).toContain(result.outcome);
      });
    });

    describe('complex combat scenarios', () => {
      it('should handle Jarl vs Jarl combat', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: -1, r: 0 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'jarl',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(2);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('blocked');
      });

      it('should handle Jarl with momentum vs Jarl (push succeeds)', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'jarl',
          playerId: 'p1',
          position: { q: -1, r: 1 },
        };
        const defender: Piece = {
          id: 'defender',
          type: 'jarl',
          playerId: 'p2',
          position: { q: 0, r: 0 },
        };
        const state = createTestState([attacker, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: -1, r: 0 },
          defender,
          { q: 0, r: 0 },
          0,
          true
        );
        expect(result.attack.total).toBe(3);
        expect(result.defense.total).toBe(2);
        expect(result.outcome).toBe('push');
      });

      it('should handle multiple support/bracing pieces', () => {
        const attacker: Piece = {
          id: 'attacker',
          type: 'warrior',
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
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const bracer1: Piece = {
          id: 'b1',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 2, r: 0 },
        };
        const bracer2: Piece = {
          id: 'b2',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 3, r: 0 },
        };
        const state = createTestState([attacker, support1, support2, defender, bracer1, bracer2]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(3);
        expect(result.defense.total).toBe(3);
        expect(result.outcome).toBe('blocked');
      });

      it('should correctly resolve edge case where attacker wins by 1', () => {
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
        const defender: Piece = {
          id: 'defender',
          type: 'warrior',
          playerId: 'p2',
          position: { q: 1, r: 0 },
        };
        const state = createTestState([attacker, supporter, defender]);
        const result = calculateCombat(
          state,
          attacker,
          { q: 0, r: 0 },
          defender,
          { q: 1, r: 0 },
          0,
          false
        );
        expect(result.attack.total).toBe(2);
        expect(result.defense.total).toBe(1);
        expect(result.outcome).toBe('push');
      });
    });
  });
});
