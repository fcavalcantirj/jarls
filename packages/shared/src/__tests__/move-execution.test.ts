import {
  isOnBoardAxial,
  createInitialState,
  getReachableHexes,
  getValidMoves,
  GameConfig,
  GameState,
  Piece,
} from '../index';

describe('Move Execution', () => {
  describe('getReachableHexes', () => {
    // Helper to create a test game state
    const createTestState = (pieces: Piece[], currentPlayerId = 'p1'): GameState => ({
      id: 'test-game',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 5,
        warriorCount: 5,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      phase: 'playing',
      currentPlayerId,
      turnNumber: 1,
      roundNumber: 1,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    });

    describe('basic functionality', () => {
      it('should return empty array for non-existent piece', () => {
        const state = createTestState([]);
        const result = getReachableHexes(state, 'non-existent');
        expect(result).toEqual([]);
      });

      it('should return empty array for shield pieces', () => {
        const pieces: Piece[] = [
          { id: 'shield1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'shield1');
        expect(result).toEqual([]);
      });
    });

    describe('Warrior movement', () => {
      it('should return 1-hex moves in all 6 directions for Warrior with clear board', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Warrior at (0,1) - can move 1 or 2 hexes in all 6 directions (within board)
        // Should have moves in multiple directions
        expect(result.length).toBeGreaterThan(0);

        // Check that there are 1-hex moves (hasMomentum = false)
        const oneHexMoves = result.filter((r) => !r.hasMomentum);
        expect(oneHexMoves.length).toBeGreaterThan(0);
      });

      it('should return 2-hex moves with momentum for Warrior', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Check that there are 2-hex moves (hasMomentum = true)
        const twoHexMoves = result.filter((r) => r.hasMomentum);
        expect(twoHexMoves.length).toBeGreaterThan(0);

        // All 2-hex moves should have hasMomentum = true
        twoHexMoves.forEach((move) => {
          expect(move.hasMomentum).toBe(true);
        });
      });

      it('should not include Throne as destination for Warrior', () => {
        // Warrior at (0, 1) can reach (0, 0) which is the Throne
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Should not include the Throne (0, 0)
        const throneMove = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
        expect(throneMove).toBeUndefined();
      });

      it('should not include off-board destinations', () => {
        // Warrior at edge (3, 0) - East direction goes off board
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // All destinations should be on board
        result.forEach((move) => {
          expect(isOnBoardAxial(move.destination, 3)).toBe(true);
        });
      });
    });

    describe('Jarl movement', () => {
      it('should return only 1-hex moves for Jarl without draft formation', () => {
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 2 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'jarl1');

        // Without Warriors behind, Jarl can only move 1 hex
        const twoHexMoves = result.filter((r) => r.hasMomentum);
        expect(twoHexMoves.length).toBe(0);
      });

      it('should return 2-hex moves for Jarl with draft formation', () => {
        // Jarl at (0, 2) with 2 Warriors behind at (0, 3) - wait, that's off board for radius 3
        // Let's use Jarl at (0, 1) with Warriors at (0, 2) and (0, 3)
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 1 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 0, r: 3 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'jarl1');

        // With draft formation behind (Southeast), Jarl can move 2 hexes toward Northwest
        const twoHexMoves = result.filter((r) => r.hasMomentum);
        expect(twoHexMoves.length).toBeGreaterThan(0);
      });

      it('should allow Jarl to enter Throne', () => {
        // Jarl adjacent to Throne at (0, 1)
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'jarl1');

        // Should include the Throne (0, 0)
        const throneMove = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
        expect(throneMove).toBeDefined();
        expect(throneMove!.moveType).toBe('move');
      });
    });

    describe('path blocking', () => {
      it('should not allow movement through friendly pieces', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } }, // Blocks path
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Should not include (0, 0) because (0, 1) is blocked by friendly piece
        const blockedMove = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
        expect(blockedMove).toBeUndefined();

        // Should not include the friendly piece's position
        const friendlyPos = result.find((r) => r.destination.q === 0 && r.destination.r === 1);
        expect(friendlyPos).toBeUndefined();
      });

      it('should not allow movement through enemy pieces', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 0, r: 1 } }, // Enemy blocks path
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Can attack enemy at (0, 1)
        const enemyAttack = result.find((r) => r.destination.q === 0 && r.destination.r === 1);
        expect(enemyAttack).toBeDefined();
        expect(enemyAttack!.moveType).toBe('attack');

        // But cannot go through to (0, 0)
        const beyondEnemy = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
        expect(beyondEnemy).toBeUndefined();
      });

      it('should not allow landing on friendly pieces', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } }, // Friendly piece East
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Should not include (2, 0) as a destination
        const friendlyPos = result.find((r) => r.destination.q === 2 && r.destination.r === 0);
        expect(friendlyPos).toBeUndefined();
      });
    });

    describe('attack detection', () => {
      it('should identify moves into enemy hexes as attacks', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } }, // Enemy piece East
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Move to (2, 0) should be an attack
        const attackMove = result.find((r) => r.destination.q === 2 && r.destination.r === 0);
        expect(attackMove).toBeDefined();
        expect(attackMove!.moveType).toBe('attack');
      });

      it('should identify moves to empty hexes as moves (not attacks)', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // All moves should be 'move' type (no enemies)
        result.forEach((move) => {
          expect(move.moveType).toBe('move');
        });
      });

      it('should include attack with momentum when moving 2 hexes into enemy', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } }, // Enemy 2 hexes East
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Attack at (2, 0) should have momentum
        const attackMove = result.find((r) => r.destination.q === 2 && r.destination.r === 0);
        expect(attackMove).toBeDefined();
        expect(attackMove!.moveType).toBe('attack');
        expect(attackMove!.hasMomentum).toBe(true);
      });
    });

    describe('direction tracking', () => {
      it('should include correct direction in results', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Check that all results have valid directions (0-5)
        result.forEach((move) => {
          expect(move.direction).toBeGreaterThanOrEqual(0);
          expect(move.direction).toBeLessThanOrEqual(5);
        });
      });

      it('should have consistent direction for 1 and 2 hex moves in same line', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Find moves toward East (direction 0): (1, 0) and (2, 0)
        const eastMoves = result.filter(
          (r) =>
            (r.destination.q === 1 && r.destination.r === 0) ||
            (r.destination.q === 2 && r.destination.r === 0)
        );

        // Both should have direction 0 (East)
        eastMoves.forEach((move) => {
          expect(move.direction).toBe(0);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle piece at board edge', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Should have fewer moves than a piece in the center
        // All destinations should be on board
        result.forEach((move) => {
          expect(isOnBoardAxial(move.destination, 3)).toBe(true);
        });
      });

      it('should handle piece at center (Throne position for Jarl)', () => {
        // Jarl at Throne can move out
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'jarl1');

        // Should have 6 one-hex moves (all 6 neighbors)
        expect(result.length).toBe(6);
        result.forEach((move) => {
          expect(move.hasMomentum).toBe(false); // No draft formation
        });
      });

      it('should return empty array for piece with null playerId that is not a shield', () => {
        // Edge case: a piece that somehow has null playerId but isn't a shield
        // This shouldn't happen in normal gameplay but tests the guard clause
        const pieces: Piece[] = [
          {
            id: 'w1',
            type: 'warrior',
            playerId: null as unknown as string,
            position: { q: 0, r: 1 },
          },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');
        expect(result).toEqual([]);
      });
    });

    describe('game scenarios', () => {
      it('should work with a realistic game state', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'shield1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);

        // Check Warrior at (2, 0)
        const warriorMoves = getReachableHexes(state, 'p1-w1');
        expect(warriorMoves.length).toBeGreaterThan(0);

        // Should not be able to move to Jarl's position (3, 0)
        const jarlPos = warriorMoves.find((r) => r.destination.q === 3 && r.destination.r === 0);
        expect(jarlPos).toBeUndefined();

        // Should not be able to move to other Warrior's position (2, 1)
        const otherWarriorPos = warriorMoves.find(
          (r) => r.destination.q === 2 && r.destination.r === 1
        );
        expect(otherWarriorPos).toBeUndefined();
      });

      it('should handle Jarl with partial draft formation', () => {
        // Jarl with only 1 Warrior behind (not enough for draft)
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 1 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'jarl1');

        // Without 2 Warriors, no draft - all moves should be 1 hex
        const twoHexMoves = result.filter((r) => r.hasMomentum);
        expect(twoHexMoves.length).toBe(0);
      });

      it('should handle Warrior blocked by shield', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
          { id: 'shield1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        // Should not be able to move to shield position or through it
        const shieldPos = result.find((r) => r.destination.q === 0 && r.destination.r === 1);
        expect(shieldPos).toBeUndefined();

        const beyondShield = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
        expect(beyondShield).toBeUndefined();
      });
    });

    describe('result structure', () => {
      it('should return ReachableHex objects with all required fields', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const result = getReachableHexes(state, 'w1');

        expect(result.length).toBeGreaterThan(0);
        result.forEach((move) => {
          expect(move).toHaveProperty('destination');
          expect(move).toHaveProperty('moveType');
          expect(move).toHaveProperty('hasMomentum');
          expect(move).toHaveProperty('direction');
          expect(move.destination).toHaveProperty('q');
          expect(move.destination).toHaveProperty('r');
          expect(['move', 'attack']).toContain(move.moveType);
          expect(typeof move.hasMomentum).toBe('boolean');
          expect(typeof move.direction).toBe('number');
        });
      });
    });
  });

  describe('getValidMoves', () => {
    // Helper to create a minimal game state for testing
    const createTestState = (pieces: Piece[], config?: Partial<GameConfig>): GameState => ({
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 5,
        warriorCount: 5,
        turnTimerMs: null,
        ...config,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 1,
      roundNumber: 1,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    });

    describe('basic functionality', () => {
      it('should return empty array for non-existent piece', () => {
        const state = createTestState([]);
        const result = getValidMoves(state, 'non-existent');
        expect(result).toEqual([]);
      });

      it('should return empty array for shields (they cannot move)', () => {
        const pieces: Piece[] = [
          { id: 'shield1', type: 'shield', playerId: null, position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'shield1');
        expect(result).toEqual([]);
      });

      it('should return same number of moves as getReachableHexes', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ];
        const state = createTestState(pieces);
        const validMoves = getValidMoves(state, 'w1');
        const reachableHexes = getReachableHexes(state, 'w1');
        expect(validMoves.length).toBe(reachableHexes.length);
      });
    });

    describe('move type detection', () => {
      it('should return moveType "move" for empty destination', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        expect(result.length).toBeGreaterThan(0);
        result.forEach((move) => {
          expect(move.moveType).toBe('move');
          expect(move.combatPreview).toBeNull();
        });
      });

      it('should return moveType "attack" for enemy-occupied destination', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const attackMoves = result.filter((m) => m.moveType === 'attack');
        expect(attackMoves.length).toBe(1);
        expect(attackMoves[0].destination).toEqual({ q: 1, r: 0 });
      });
    });

    describe('combat preview for attacks', () => {
      it('should include combat preview for attack moves', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const attackMove = result.find((m) => m.moveType === 'attack');
        expect(attackMove).toBeDefined();
        expect(attackMove!.combatPreview).not.toBeNull();
        expect(attackMove!.combatPreview!.attackerId).toBe('w1');
        expect(attackMove!.combatPreview!.defenderId).toBe('w2');
      });

      it('should have null combat preview for regular moves', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        result.forEach((move) => {
          expect(move.combatPreview).toBeNull();
        });
      });

      it('should calculate correct attack/defense values in combat preview', () => {
        // Warrior attacking warrior - base strength 1 vs 1
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const attackMove = result.find((m) => m.moveType === 'attack');
        expect(attackMove!.combatPreview!.attack.baseStrength).toBe(1);
        expect(attackMove!.combatPreview!.defense.baseStrength).toBe(1);
      });

      it('should include momentum bonus in attack calculation', () => {
        // Warrior moving 2 hexes to attack
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        // Find the 2-hex attack (with momentum)
        const momentumAttack = result.find(
          (m) =>
            m.moveType === 'attack' &&
            m.hasMomentum &&
            m.destination.q === 1 &&
            m.destination.r === 0
        );
        expect(momentumAttack).toBeDefined();
        expect(momentumAttack!.combatPreview!.attack.momentum).toBe(1);
        expect(momentumAttack!.combatPreview!.attack.total).toBe(2); // 1 base + 1 momentum
      });

      it('should include support pieces in attack calculation', () => {
        // Warrior with friendly Jarl behind (support)
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        // Attack toward East (direction 0), with Jarl behind (West, direction 3)
        const attackMove = result.find(
          (m) => m.moveType === 'attack' && m.destination.q === 1 && m.destination.r === 0
        );
        expect(attackMove).toBeDefined();
        // Jarl provides +2 support
        expect(attackMove!.combatPreview!.attack.support).toBe(2);
        expect(attackMove!.combatPreview!.attack.total).toBe(3); // 1 base + 2 support
      });

      it('should include bracing pieces in defense calculation', () => {
        // Defender with friendly Warrior behind (bracing)
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
          { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        // Attack toward East - w2 has w3 bracing behind
        const attackMove = result.find(
          (m) => m.moveType === 'attack' && m.destination.q === 1 && m.destination.r === 0
        );
        expect(attackMove).toBeDefined();
        // w3 provides +1 bracing
        expect(attackMove!.combatPreview!.defense.support).toBe(1);
        expect(attackMove!.combatPreview!.defense.total).toBe(2); // 1 base + 1 bracing
      });

      it('should correctly determine push outcome', () => {
        // Attack where attacker wins (with momentum)
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const momentumAttack = result.find((m) => m.moveType === 'attack' && m.hasMomentum);
        expect(momentumAttack).toBeDefined();
        // Attack: 2 (1 base + 1 momentum) vs Defense: 1 (base)
        expect(momentumAttack!.combatPreview!.outcome).toBe('push');
        expect(momentumAttack!.combatPreview!.pushDirection).not.toBeNull();
      });

      it('should correctly determine blocked outcome', () => {
        // Attack where defender wins (with bracing)
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
          { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const attackMove = result.find(
          (m) => m.moveType === 'attack' && m.destination.q === 1 && m.destination.r === 0
        );
        expect(attackMove).toBeDefined();
        // Attack: 1 (base) vs Defense: 2 (1 base + 1 bracing)
        expect(attackMove!.combatPreview!.outcome).toBe('blocked');
        expect(attackMove!.combatPreview!.pushDirection).toBeNull();
      });
    });

    describe('hasMomentum flag', () => {
      it('should set hasMomentum true for 2-hex moves', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const momentumMoves = result.filter((m) => m.hasMomentum);
        expect(momentumMoves.length).toBeGreaterThan(0);

        // All momentum moves should be 2 hexes away
        momentumMoves.forEach((move) => {
          const distance =
            Math.abs(move.destination.q - 0) +
            Math.abs(move.destination.r - 0) +
            Math.abs(-move.destination.q - move.destination.r - 0);
          expect(distance / 2).toBe(2);
        });
      });

      it('should set hasMomentum false for 1-hex moves', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const nonMomentumMoves = result.filter((m) => !m.hasMomentum);
        expect(nonMomentumMoves.length).toBeGreaterThan(0);

        // All non-momentum moves should be 1 hex away
        nonMomentumMoves.forEach((move) => {
          const distance =
            Math.abs(move.destination.q - 0) +
            Math.abs(move.destination.r - 0) +
            Math.abs(-move.destination.q - move.destination.r - 0);
          expect(distance / 2).toBe(1);
        });
      });
    });

    describe('Jarl with draft formation', () => {
      it('should include 2-hex moves for Jarl with draft', () => {
        // Jarl with 2 Warriors behind (draft formation)
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'jarl1');

        // Should have 2-hex move toward East (opposite of where Warriors are)
        const twoHexMoves = result.filter((m) => m.hasMomentum);
        expect(twoHexMoves.length).toBeGreaterThan(0);
        // Should have a move to (2, 0) with momentum
        const eastDraftMove = twoHexMoves.find(
          (m) => m.destination.q === 2 && m.destination.r === 0
        );
        expect(eastDraftMove).toBeDefined();
      });

      it('should include combat preview for Jarl draft attack', () => {
        // Jarl with draft attacking an enemy
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'jarl1');

        const draftAttack = result.find(
          (m) =>
            m.moveType === 'attack' &&
            m.hasMomentum &&
            m.destination.q === 2 &&
            m.destination.r === 0
        );
        expect(draftAttack).toBeDefined();
        expect(draftAttack!.combatPreview).not.toBeNull();
        // Jarl base strength is 2, plus momentum +1
        expect(draftAttack!.combatPreview!.attack.baseStrength).toBe(2);
        expect(draftAttack!.combatPreview!.attack.momentum).toBe(1);
        expect(draftAttack!.combatPreview!.attack.total).toBe(3);
      });
    });

    describe('result structure', () => {
      it('should return ValidMove objects with all required fields', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        expect(result.length).toBeGreaterThan(0);
        result.forEach((move) => {
          expect(move).toHaveProperty('destination');
          expect(move).toHaveProperty('moveType');
          expect(move).toHaveProperty('hasMomentum');
          expect(move).toHaveProperty('combatPreview');
          expect(move.destination).toHaveProperty('q');
          expect(move.destination).toHaveProperty('r');
          expect(['move', 'attack']).toContain(move.moveType);
          expect(typeof move.hasMomentum).toBe('boolean');
        });
      });

      it('should include full CombatResult structure for attacks', () => {
        const pieces: Piece[] = [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'w1');

        const attackMove = result.find((m) => m.moveType === 'attack');
        expect(attackMove).toBeDefined();
        const preview = attackMove!.combatPreview!;

        expect(preview).toHaveProperty('attackerId');
        expect(preview).toHaveProperty('defenderId');
        expect(preview).toHaveProperty('attack');
        expect(preview).toHaveProperty('defense');
        expect(preview).toHaveProperty('outcome');
        expect(preview).toHaveProperty('pushDirection');

        // Attack breakdown
        expect(preview.attack).toHaveProperty('baseStrength');
        expect(preview.attack).toHaveProperty('momentum');
        expect(preview.attack).toHaveProperty('support');
        expect(preview.attack).toHaveProperty('total');

        // Defense breakdown
        expect(preview.defense).toHaveProperty('baseStrength');
        expect(preview.defense).toHaveProperty('momentum');
        expect(preview.defense).toHaveProperty('support');
        expect(preview.defense).toHaveProperty('total');
      });
    });

    describe('game scenarios', () => {
      it('should work with realistic initial game state', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.phase = 'playing';

        // Find a warrior for player 1
        const warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.players[0].id
        );
        expect(warrior).toBeDefined();

        const result = getValidMoves(state, warrior!.id);
        expect(result.length).toBeGreaterThan(0);

        // All moves should have valid structure
        result.forEach((move) => {
          expect(move.destination).toBeDefined();
          expect(move.moveType).toBeDefined();
          expect(typeof move.hasMomentum).toBe('boolean');
        });
      });

      it('should handle Jarl vs Jarl combat preview', () => {
        const pieces: Piece[] = [
          { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'jarl2', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);
        const result = getValidMoves(state, 'jarl1');

        const attackMove = result.find((m) => m.moveType === 'attack');
        expect(attackMove).toBeDefined();
        // Jarl vs Jarl: both have base strength 2
        expect(attackMove!.combatPreview!.attack.baseStrength).toBe(2);
        expect(attackMove!.combatPreview!.defense.baseStrength).toBe(2);
        // Attack 2 vs Defense 2 = blocked
        expect(attackMove!.combatPreview!.outcome).toBe('blocked');
      });
    });
  });
});
