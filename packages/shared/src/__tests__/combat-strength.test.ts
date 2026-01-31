import {
  HexDirection,
  createInitialState,
  getPieceStrength,
  findInlineSupport,
  findBracing,
  GameState,
  Piece,
} from '../index';

describe('Combat Strength', () => {
  describe('getPieceStrength', () => {
    it('should return 2 for Jarl', () => {
      const piece: Piece = {
        id: 'jarl1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      expect(getPieceStrength(piece)).toBe(2);
    });

    it('should return 1 for Warrior', () => {
      const piece: Piece = {
        id: 'warrior1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      expect(getPieceStrength(piece)).toBe(1);
    });
  });

  describe('findInlineSupport', () => {
    // Helper to create a minimal game state for testing
    function createTestState(pieces: Piece[]): GameState {
      return {
        id: 'test',
        phase: 'playing',
        config: {
          playerCount: 2,
          boardRadius: 3,
          warriorCount: 5,
          turnTimerMs: null,
          terrain: 'calm',
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

    describe('basic functionality', () => {
      it('should return empty array when no pieces are behind attacker', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // No pieces behind (to the West)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });

      it('should find single Warrior providing support', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (-1,0) - directly behind (West)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('supporter');
        expect(result.totalStrength).toBe(1);
      });

      it('should find multiple Warriors providing support', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warriors at (-1,0) and (-2,0) - two behind
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'supporter2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(2); // 1 + 1
      });

      it('should find Jarl providing support with strength 2', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Jarl at (-1,0) - directly behind
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('jarl');
        expect(result.totalStrength).toBe(2);
      });

      it('should sum strength of mixed piece types', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (-1,0), Jarl at (-2,0)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'warrior', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: -2, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(3); // 1 (Warrior) + 2 (Jarl)
      });
    });

    describe('stops at empty hex', () => {
      it('should stop collecting support at first empty hex', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (-1,0), empty at (-2,0), Warrior at (-3,0)
        // Support line should stop at the gap
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          // Gap at (-2, 0)
          { id: 'supporter2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('supporter1');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when first hex behind is empty', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Empty at (-1,0), Warrior at (-2,0)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at enemy piece', () => {
      it('should stop collecting support at enemy piece', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (-1,0), enemy at (-2,0), Warrior at (-3,0)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'blocked', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('supporter');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when enemy is directly behind', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Enemy at (-1,0)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at hole', () => {
      it('should stop collecting support at hole (no piece on hole)', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (-1,0), hole at (-2,0), Warrior at (-3,0)
        // Holes cannot have pieces, so support stops at the empty hole position
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          // Gap at (-2, 0) is a hole - no piece can be there
          { id: 'blocked', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
        ]);
        // Add hole at (-2,0) - pieces can't be placed there
        state.holes = [{ q: -2, r: 0 }];

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('supporter');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when hole is directly behind', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Hole at (-1,0) - no piece can be there
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ]);
        state.holes = [{ q: -1, r: 0 }];

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at board edge', () => {
      it('should stop collecting support at board edge', () => {
        // Attacker at edge, attacking inward
        // For radius 3 board, (-3,0) is on the edge (West)
        // Attacker at (-2,0), attacking East (direction 0)
        // Warrior at (-3,0) - at edge
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: -2, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('supporter');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when at board edge with no room behind', () => {
        // Attacker at edge, attacking inward
        // For radius 3 board, (-3,0) is on the edge
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: -3, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('different attack directions', () => {
      it('should find support when attacking Northeast (direction 1)', () => {
        // Attack direction 1 (Northeast), support from Southwest (direction 4)
        // Direction 4 vector: { q: -1, r: 1 }
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: -1, r: 1 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 1);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });

      it('should find support when attacking West (direction 3)', () => {
        // Attack direction 3 (West), support from East (direction 0)
        // Direction 0 vector: { q: 1, r: 0 }
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 3);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });

      it('should find support when attacking Southeast (direction 5)', () => {
        // Attack direction 5 (Southeast), support from Northwest (direction 2)
        // Direction 2 vector: { q: 0, r: -1 }
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'supporter', type: 'warrior', playerId: 'p1', position: { q: 0, r: -1 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 5);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });
    });

    describe('pieces not in support line are ignored', () => {
      it('should not include pieces adjacent but not in line', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (0,1) - adjacent but not in support line (Southwest, not West)
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'notSupporter', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });

      it('should not include pieces in front of attacker', () => {
        // Attacker at (0,0), attacking East (direction 0)
        // Warrior at (1,0) - in front, not behind
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'inFront', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('game scenarios', () => {
      it('should calculate support in realistic attack scenario', () => {
        // Player 1 has a formation:
        // Warrior at (1,0) attacking East into (2,0)
        // Jarl at (0,0) and Warrior at (-1,0) behind
        const state = createTestState([
          { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'warrior', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'defender', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        ]);

        const result = findInlineSupport(state, { q: 1, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(3); // Jarl (2) + Warrior (1)
      });

      it('should work with actual initial game state', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.phase = 'playing';

        // Find a warrior that might have support
        const warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.currentPlayerId
        );
        expect(warrior).toBeDefined();
        if (!warrior) return;

        // Check all 6 directions - should not crash
        for (let d = 0; d < 6; d++) {
          const result = findInlineSupport(
            state,
            warrior.position,
            state.currentPlayerId!,
            d as HexDirection
          );
          expect(result.pieces).toBeDefined();
          expect(result.totalStrength).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('findBracing', () => {
    // Helper to create a minimal game state for testing
    function createTestState(pieces: Piece[]): GameState {
      return {
        id: 'test',
        phase: 'playing',
        config: {
          playerCount: 2,
          boardRadius: 3,
          warriorCount: 5,
          turnTimerMs: null,
          terrain: 'calm',
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

    describe('basic functionality', () => {
      it('should return empty array when no pieces are behind defender', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // No pieces behind (to the East)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });

      it('should find single Warrior providing bracing', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (1,0) - directly behind in push direction (East)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('bracer');
        expect(result.totalStrength).toBe(1);
      });

      it('should find multiple Warriors providing bracing', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warriors at (1,0) and (2,0) - two behind in push direction
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'bracer2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(2); // 1 + 1
      });

      it('should find Jarl providing bracing with strength 2', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Jarl at (1,0) - directly behind in push direction
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('jarl');
        expect(result.totalStrength).toBe(2);
      });

      it('should sum strength of mixed piece types', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (1,0), Jarl at (2,0)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'warrior', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(3); // 1 (Warrior) + 2 (Jarl)
      });
    });

    describe('stops at empty hex', () => {
      it('should stop collecting bracing at first empty hex', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (1,0), empty at (2,0), Warrior at (3,0)
        // Bracing line should stop at the gap
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          // Gap at (2, 0)
          { id: 'bracer2', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('bracer1');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when first hex behind is empty', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Empty at (1,0), Warrior at (2,0)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at enemy piece', () => {
      it('should stop collecting bracing at enemy piece', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (1,0), enemy at (2,0), Warrior at (3,0)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
          { id: 'blocked', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('bracer');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when enemy is directly behind', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Enemy at (1,0)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at hole', () => {
      it('should stop collecting bracing at hole (no piece on hole)', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (1,0), hole at (2,0), Warrior at (3,0)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          // Gap at (2,0) is a hole - no piece can be there
          { id: 'blocked', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ]);
        state.holes = [{ q: 2, r: 0 }];

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('bracer');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when hole is directly behind', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Hole at (1,0) - no piece can be there
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        ]);
        state.holes = [{ q: 1, r: 0 }];

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('stops at board edge', () => {
      it('should stop collecting bracing at board edge', () => {
        // Defender at (2,0), being pushed East (direction 0)
        // Warrior at (3,0) - at edge, radius is 3
        // Should find the warrior but stop at edge
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ]);

        const result = findBracing(state, { q: 2, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(1);
        expect(result.pieces[0].id).toBe('bracer');
        expect(result.totalStrength).toBe(1);
      });

      it('should return empty when at board edge with no room behind', () => {
        // Defender at (3,0), being pushed East (direction 0)
        // No room behind because (4,0) is off board (radius 3)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
        ]);

        const result = findBracing(state, { q: 3, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('different push directions', () => {
      it('should find bracing when pushed Northeast (direction 1)', () => {
        // Push direction 1 (Northeast), bracing from Northeast
        // Direction 1 vector: { q: 1, r: -1 }
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 1);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });

      it('should find bracing when pushed West (direction 3)', () => {
        // Push direction 3 (West), bracing from West
        // Direction 3 vector: { q: -1, r: 0 }
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 3);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });

      it('should find bracing when pushed Southeast (direction 5)', () => {
        // Push direction 5 (Southeast), bracing from Southeast
        // Direction 5 vector: { q: 0, r: 1 }
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'bracer', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 5);

        expect(result.pieces).toHaveLength(1);
        expect(result.totalStrength).toBe(1);
      });
    });

    describe('pieces not in bracing line are ignored', () => {
      it('should not include pieces adjacent but not in line', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (0,1) - adjacent but not in push direction (Southeast, not East)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'notBracer', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });

      it('should not include pieces in opposite direction of push', () => {
        // Defender at (0,0), being pushed East (direction 0)
        // Warrior at (-1,0) - in opposite direction (West, not East)
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'notBracer', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        ]);

        const result = findBracing(state, { q: 0, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(0);
        expect(result.totalStrength).toBe(0);
      });
    });

    describe('game scenarios', () => {
      it('should calculate bracing in realistic defense scenario', () => {
        // Player 1 defender has a formation:
        // Defender Warrior at (1,0) being pushed East
        // Jarl at (2,0) and Warrior at (3,0) bracing behind
        const state = createTestState([
          { id: 'defender', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'warrior', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'attacker', type: 'warrior', playerId: 'p2', position: { q: 0, r: 0 } },
        ]);

        const result = findBracing(state, { q: 1, r: 0 }, 'p1', 0);

        expect(result.pieces).toHaveLength(2);
        expect(result.totalStrength).toBe(3); // Jarl (2) + Warrior (1)
      });

      it('should work with actual initial game state', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.phase = 'playing';

        // Find a warrior that might have bracing
        const warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.currentPlayerId
        );
        expect(warrior).toBeDefined();
        if (!warrior) return;

        // Check all 6 directions - should not crash
        for (let d = 0; d < 6; d++) {
          const result = findBracing(
            state,
            warrior.position,
            state.currentPlayerId!,
            d as HexDirection
          );
          expect(result.pieces).toBeDefined();
          expect(result.totalStrength).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
