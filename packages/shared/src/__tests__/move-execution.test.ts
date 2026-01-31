import { isOnBoardAxial, getReachableHexes, GameState, Piece } from '../index';

describe('Move Execution - getReachableHexes', () => {
  // Helper to create a test game state
  const createTestState = (pieces: Piece[], currentPlayerId = 'p1'): GameState => ({
    id: 'test-game',
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players: [
      { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
    ],
    pieces,
    holes: [],
    phase: 'playing',
    currentPlayerId,
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  });

  describe('basic functionality', () => {
    it('should return empty array for non-existent piece', () => {
      const state = createTestState([]);
      const result = getReachableHexes(state, 'non-existent');
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

    it('should handle Warrior blocked by hole', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 2 } },
      ];
      const state = createTestState(pieces);
      // Add hole to block the path
      state.holes = [{ q: 0, r: 1 }];
      const result = getReachableHexes(state, 'w1');

      // Should not be able to move to hole position or through it
      const holePos = result.find((r) => r.destination.q === 0 && r.destination.r === 1);
      expect(holePos).toBeUndefined();

      const beyondHole = result.find((r) => r.destination.q === 0 && r.destination.r === 0);
      expect(beyondHole).toBeUndefined();
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
