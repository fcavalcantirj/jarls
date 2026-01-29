import {
  createInitialState,
  getReachableHexes,
  getValidMoves,
  GameConfig,
  GameState,
  Piece,
} from '../index';

describe('Move Execution - getValidMoves', () => {
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
    firstPlayerIndex: 0,
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
      // Jarl attacking warrior (2 vs 1 = push, valid attack)
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'jarl1');

      const attackMoves = result.filter((m) => m.moveType === 'attack');
      expect(attackMoves.length).toBe(1);
      expect(attackMoves[0].destination).toEqual({ q: 1, r: 0 });
    });
  });

  describe('combat preview for attacks', () => {
    it('should include combat preview for attack moves', () => {
      // Jarl attacking warrior (2 vs 1 = push)
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'jarl1');

      const attackMove = result.find((m) => m.moveType === 'attack');
      expect(attackMove).toBeDefined();
      expect(attackMove!.combatPreview).not.toBeNull();
      expect(attackMove!.combatPreview!.attackerId).toBe('jarl1');
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
      // Jarl attacking warrior - base strength 2 vs 1 (push)
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'jarl1');

      const attackMove = result.find((m) => m.moveType === 'attack');
      expect(attackMove).toBeDefined();
      expect(attackMove!.combatPreview!.attack.baseStrength).toBe(2);
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
          m.moveType === 'attack' && m.hasMomentum && m.destination.q === 1 && m.destination.r === 0
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
      // Jarl attacker (2) with support (+2) vs Warrior (1) with bracing (+1)
      // Attack: 4, Defense: 2 = push
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } }, // support behind
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } }, // bracing
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

    it('should NOT include attacks that would be blocked', () => {
      // Attack where defender wins (with bracing) - should NOT be a valid move
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'w1');

      // Blocked attacks should not appear in valid moves
      const attackMove = result.find(
        (m) => m.moveType === 'attack' && m.destination.q === 1 && m.destination.r === 0
      );
      expect(attackMove).toBeUndefined();
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
      const eastDraftMove = twoHexMoves.find((m) => m.destination.q === 2 && m.destination.r === 0);
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
          m.moveType === 'attack' && m.hasMomentum && m.destination.q === 2 && m.destination.r === 0
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
      // Position warrior 2 hexes away so attack has momentum (2 vs 1 = push)
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
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

    it('should NOT show Jarl vs Jarl attack when it would be blocked', () => {
      // Jarl vs Jarl at 1 hex: 2 vs 2 = blocked, so attack should not be valid
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'jarl2', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'jarl1');

      // Blocked attacks should not appear in valid moves
      const attackMove = result.find((m) => m.moveType === 'attack');
      expect(attackMove).toBeUndefined();
    });

    it('should show Jarl vs Warrior attack when it would push', () => {
      // Jarl (2) vs Warrior (1) = push, so attack should be valid
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const result = getValidMoves(state, 'jarl1');

      const attackMove = result.find((m) => m.moveType === 'attack');
      expect(attackMove).toBeDefined();
      expect(attackMove!.combatPreview!.outcome).toBe('push');
    });
  });
});
