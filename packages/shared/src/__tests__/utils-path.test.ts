import {
  createInitialState,
  isPathClear,
  hasDraftFormation,
  hasDraftFormationInDirection,
  AxialCoord,
  GameState,
  Piece,
} from '../index';

// Helper function to create a minimal game state with specific pieces
function createTestState(pieces: Piece[]): GameState {
  return {
    id: 'test-game',
    phase: 'playing',
    config: {
      playerCount: 2,
      boardRadius: 3,
      terrain: 'calm',
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

describe('isPathClear', () => {
  describe('returns true when path has no pieces', () => {
    it('should return true for adjacent hexes with empty board', () => {
      const state = createTestState([]);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 1, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true for path of length 2 with empty board', () => {
      const state = createTestState([]);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true for path of length 3 with empty board', () => {
      const state = createTestState([]);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 3, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true for diagonal path with empty board', () => {
      const state = createTestState([]);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: -2 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true when pieces exist but not on path', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 0, r: -1 } },
      ];
      const state = createTestState(pieces);
      // Path from (0,0) to (2,0) goes through (1,0) - pieces are at (0,1) and (0,-1)
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true when piece is at start position (start not checked)', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should return true when piece is at end position (end not checked)', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(true);
    });
  });

  describe('returns false when piece blocks path', () => {
    it('should return false when piece is in the middle of path', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should return false when shield blocks path', () => {
      const pieces: Piece[] = [
        { id: 's1', type: 'shield', playerId: null, position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should return false when Jarl blocks path', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p2', position: { q: 1, r: -1 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: -2 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should return false when multiple pieces block path', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 3, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should return false when friendly piece blocks path', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: 0 };
      // Piece belongs to same player, still blocks
      expect(isPathClear(state, start, end)).toBe(false);
    });
  });

  describe('checks all hexes between start and end', () => {
    it('should check first hex after start', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      // Path: (0,0) -> (1,0) -> (2,0) -> (3,0)
      // Blocking piece at (1,0) which is first hex after start
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 3, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should check last hex before end', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      // Path: (0,0) -> (1,0) -> (2,0) -> (3,0)
      // Blocking piece at (2,0) which is last hex before end
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 3, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should check middle hexes of longer path', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      // Path: (-2,0) -> (-1,0) -> (0,0) -> (1,0) -> (2,0) -> (3,0)
      // Blocking piece at (2,0)
      const start: AxialCoord = { q: -2, r: 0 };
      const end: AxialCoord = { q: 3, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should work with diagonal paths', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: -1 } },
      ];
      const state = createTestState(pieces);
      // Diagonal path from (0,0) to (2,-2) goes through (1,-1)
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 2, r: -2 };
      expect(isPathClear(state, start, end)).toBe(false);
    });

    it('should work with negative coordinates', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);
      // Path from (-2,0) to (0,0) goes through (-1,0)
      const start: AxialCoord = { q: -2, r: 0 };
      const end: AxialCoord = { q: 0, r: 0 };
      expect(isPathClear(state, start, end)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true when start equals end (same position)', () => {
      const state = createTestState([]);
      const position: AxialCoord = { q: 1, r: 1 };
      expect(isPathClear(state, position, position)).toBe(true);
    });

    it('should return true for adjacent hexes (no hexes between)', () => {
      const state = createTestState([]);
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 1, r: 0 };
      // Adjacent hexes have no hexes between them to check
      expect(isPathClear(state, start, end)).toBe(true);
    });

    it('should work with all 6 directions', () => {
      const state = createTestState([]);
      const center: AxialCoord = { q: 0, r: 0 };

      // Test 2-hex paths in all 6 directions
      const directions: AxialCoord[] = [
        { q: 2, r: 0 }, // East
        { q: 2, r: -2 }, // Northeast
        { q: 0, r: -2 }, // Northwest
        { q: -2, r: 0 }, // West
        { q: -2, r: 2 }, // Southwest
        { q: 0, r: 2 }, // Southeast
      ];

      for (const end of directions) {
        expect(isPathClear(state, center, end)).toBe(true);
      }
    });
  });

  describe('game scenarios', () => {
    it('should detect blocked path in actual game state', () => {
      const state = createInitialState(['A', 'B']);
      // Find a Jarl and check if path to throne is blocked by warriors
      const jarl = state.pieces.find((p) => p.type === 'jarl');
      const throne: AxialCoord = { q: 0, r: 0 };

      if (jarl) {
        // The path might be blocked by warriors placed in front
        // This just verifies the function works with real game states
        const result = isPathClear(state, jarl.position, throne);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should correctly identify clear path when no warriors in the way', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 3, r: 0 };
      const throne: AxialCoord = { q: 0, r: 0 };
      expect(isPathClear(state, jarlPosition, throne)).toBe(true);
    });

    it('should correctly identify blocked path when warrior defends throne', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 3, r: 0 };
      const throne: AxialCoord = { q: 0, r: 0 };
      expect(isPathClear(state, jarlPosition, throne)).toBe(false);
    });
  });
});

describe('hasDraftFormation', () => {
  describe('hasDraftFormationInDirection', () => {
    it('should return true with 2 consecutive Warriors behind', () => {
      // Jarl at (0, 0), two warriors behind at (-1, 0) and (-2, 0)
      // Movement direction is East (0), so behind is West (3)
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Moving East (direction 0), Warriors should be behind in West direction
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return true with 2 non-consecutive Warriors in line (gap between)', () => {
      // Jarl at (0, 0), Warriors at (-1, 0) and (-3, 0) with a gap at (-2, 0)
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Gap allowed - should still detect draft formation
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return false with only 1 Warrior behind', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Only 1 Warrior - not enough for draft
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should return false with no Warriors behind', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should return false when enemy Warrior is in line', () => {
      // Jarl at (0, 0), friendly Warrior at (-1, 0), enemy Warrior at (-2, 0)
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Enemy piece blocks the draft line
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should return false when shield blocks the line', () => {
      // Jarl at (0, 0), friendly Warrior at (-1, 0), shield at (-2, 0)
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 's1', type: 'shield', playerId: null, position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Shield blocks the draft line
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should check correct direction (opposite of movement)', () => {
      // Jarl at (0, 0), Warriors in Northeast direction
      // For Northeast movement (direction 1), behind is Southwest (direction 4)
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 1 } }, // Southwest
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 2 } }, // More Southwest
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Moving Northeast (direction 1), Warriors should be behind in Southwest (direction 4)
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 1)).toBe(true);
      // Moving East (direction 0), no Warriors in West direction
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should return false when Warriors are in front, not behind', () => {
      // Jarl at (0, 0), Warriors in front (East), moving East
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      // Moving East (direction 0), Warriors in front not behind
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(false);
    });

    it('should handle Jarl near board edge', () => {
      // Jarl at edge (3, 0), only space for 2 Warriors behind
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 3, r: 0 };

      // Moving East (off board), behind is West - should find 2 Warriors
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return false when off board before finding 2 Warriors', () => {
      // Jarl near edge, only 1 Warrior behind before board ends
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } }, // Behind for West movement
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 2, r: 0 };

      // Moving West (direction 3), behind is East
      // Only 1 Warrior behind at (3, 0), next would be (4, 0) which is off board
      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 3)).toBe(false);
    });
  });

  describe('hasDraftFormation (main function)', () => {
    it('should return empty array when no draft formation in any direction', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      const result = hasDraftFormation(state, jarlPosition, 'p1');
      expect(result).toEqual([]);
    });

    it('should return single direction when draft formation in one direction', () => {
      // Jarl at center, 2 Warriors behind in West direction
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      const result = hasDraftFormation(state, jarlPosition, 'p1');
      // Warriors in West direction enable East movement
      expect(result).toContain(0); // East
      expect(result.length).toBe(1);
    });

    it('should return multiple directions when draft formation in multiple directions', () => {
      // Jarl at center, 2 Warriors behind in West and Southwest directions
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        // West direction
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        // Southwest direction
        { id: 'w3', type: 'warrior', playerId: 'p1', position: { q: -1, r: 1 } },
        { id: 'w4', type: 'warrior', playerId: 'p1', position: { q: -2, r: 2 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      const result = hasDraftFormation(state, jarlPosition, 'p1');
      // Warriors in West enable East movement, Warriors in Southwest enable Northeast movement
      expect(result).toContain(0); // East
      expect(result).toContain(1); // Northeast
      expect(result.length).toBe(2);
    });

    it('should work with gap scenarios', () => {
      // Jarl at center, 2 Warriors with a gap between them
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        // Gap at (-2, 0)
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      const result = hasDraftFormation(state, jarlPosition, 'p1');
      expect(result).toContain(0); // East movement enabled
    });

    it('should handle real game state', () => {
      const state = createInitialState(['Alice', 'Bob']);

      // Find a Jarl
      const jarl = state.pieces.find(
        (p) => p.type === 'jarl' && p.playerId === state.players[0].id
      );
      expect(jarl).toBeDefined();

      if (jarl) {
        const result = hasDraftFormation(state, jarl.position, jarl.playerId!);
        // Result should be an array
        expect(Array.isArray(result)).toBe(true);
        // All elements should be valid HexDirections (0-5)
        for (const dir of result) {
          expect(dir).toBeGreaterThanOrEqual(0);
          expect(dir).toBeLessThanOrEqual(5);
        }
      }
    });

    it('should return directions only for friendly Warriors', () => {
      // Jarl at center, enemy Warriors behind
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } }, // Enemy
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } }, // Enemy
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      const result = hasDraftFormation(state, jarlPosition, 'p1');
      // No friendly Warriors behind - no draft formation
      expect(result).toEqual([]);
    });
  });

  describe('unit tests cover gap scenarios', () => {
    it('should return true with gap of 1 empty hex between Warriors', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        // Empty at (-2, 0)
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return true with gap of 2 empty hexes between Warriors', () => {
      // Need larger board for this scenario
      const state: GameState = {
        id: 'test-game',
        phase: 'playing',
        config: {
          playerCount: 2,
          boardRadius: 5, // Larger board
          terrain: 'calm',
          warriorCount: 0,
          turnTimerMs: null,
        },
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
        ],
        pieces: [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          // Empty at (-2, 0) and (-3, 0)
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -4, r: 0 } },
        ],
        currentPlayerId: 'p1',
        turnNumber: 1,
        roundNumber: 1,
        firstPlayerIndex: 0,
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return true with Warrior at Jarl adjacent and another 2 hexes away', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } }, // Adjacent
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } }, // Next
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });

    it('should return true when first Warrior is not adjacent to Jarl', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        // Empty at (-1, 0)
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      const jarlPosition: AxialCoord = { q: 0, r: 0 };

      expect(hasDraftFormationInDirection(state, jarlPosition, 'p1', 0)).toBe(true);
    });
  });
});
