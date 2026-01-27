import {
  hexToKey,
  keyToHex,
  createInitialState,
  getPieceAt,
  getPieceById,
  isPathClear,
  hasDraftFormation,
  hasDraftFormationInDirection,
  getDirectionBetweenAdjacent,
  getLineDirection,
  checkThroneVictory,
  eliminatePlayer,
  checkLastStanding,
  checkWinConditions,
  AxialCoord,
  GameState,
  Piece,
} from './index';

describe('@jarls/shared', () => {
  // VERSION tests moved to __tests__/types.test.ts

  // Hex coordinate tests moved to __tests__/hex.test.ts

  // Board generation tests moved to __tests__/board.test.ts

  describe('getPieceAt', () => {
    it('should return piece when one exists at position', () => {
      const state = createInitialState(['A', 'B']);
      // Get any piece and verify getPieceAt finds it
      const piece = state.pieces[0];
      const found = getPieceAt(state, piece.position);
      expect(found).toBeDefined();
      expect(found?.id).toBe(piece.id);
    });

    it('should return undefined when no piece at position', () => {
      const state = createInitialState(['A', 'B']);
      // The throne is always empty at game start
      const throne: AxialCoord = { q: 0, r: 0 };
      const found = getPieceAt(state, throne);
      expect(found).toBeUndefined();
    });

    it('should find pieces at various positions', () => {
      const state = createInitialState(['A', 'B']);
      // Check every piece can be found by its position
      for (const piece of state.pieces) {
        const found = getPieceAt(state, piece.position);
        expect(found).toBeDefined();
        expect(found?.id).toBe(piece.id);
        expect(found?.type).toBe(piece.type);
      }
    });

    it('should return undefined for off-board positions', () => {
      const state = createInitialState(['A', 'B']);
      // Position far outside the board
      const offBoard: AxialCoord = { q: 100, r: 100 };
      const found = getPieceAt(state, offBoard);
      expect(found).toBeUndefined();
    });

    it('should find Jarl pieces correctly', () => {
      const state = createInitialState(['A', 'B']);
      const jarls = state.pieces.filter((p) => p.type === 'jarl');
      expect(jarls).toHaveLength(2);

      for (const jarl of jarls) {
        const found = getPieceAt(state, jarl.position);
        expect(found).toBeDefined();
        expect(found?.type).toBe('jarl');
        expect(found?.id).toBe(jarl.id);
      }
    });

    it('should find Warrior pieces correctly', () => {
      const state = createInitialState(['A', 'B']);
      const warriors = state.pieces.filter((p) => p.type === 'warrior');

      for (const warrior of warriors) {
        const found = getPieceAt(state, warrior.position);
        expect(found).toBeDefined();
        expect(found?.type).toBe('warrior');
        expect(found?.id).toBe(warrior.id);
      }
    });

    it('should find Shield pieces correctly', () => {
      const state = createInitialState(['A', 'B']);
      const shields = state.pieces.filter((p) => p.type === 'shield');

      for (const shield of shields) {
        const found = getPieceAt(state, shield.position);
        expect(found).toBeDefined();
        expect(found?.type).toBe('shield');
        expect(found?.id).toBe(shield.id);
        expect(found?.playerId).toBeNull(); // Shields have no owner
      }
    });

    it('should handle empty game state gracefully', () => {
      const state = createInitialState(['A', 'B']);
      // Create an empty pieces array
      const emptyState = { ...state, pieces: [] };
      const found = getPieceAt(emptyState, { q: 0, r: 0 });
      expect(found).toBeUndefined();
    });

    it('should return correct piece when multiple pieces exist', () => {
      const state = createInitialState(['A', 'B']);
      // Ensure each position has exactly the piece we expect
      const positionMap = new Map<string, string>();
      for (const piece of state.pieces) {
        positionMap.set(hexToKey(piece.position), piece.id);
      }

      for (const [posKey, expectedId] of positionMap) {
        const pos = keyToHex(posKey);
        if (pos) {
          const found = getPieceAt(state, pos);
          expect(found?.id).toBe(expectedId);
        }
      }
    });
  });

  describe('getPieceById', () => {
    it('should return piece when ID exists', () => {
      const state = createInitialState(['A', 'B']);
      const piece = state.pieces[0];
      const found = getPieceById(state, piece.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(piece.id);
      expect(found?.type).toBe(piece.type);
      expect(found?.position).toEqual(piece.position);
    });

    it('should return undefined when ID does not exist', () => {
      const state = createInitialState(['A', 'B']);
      const found = getPieceById(state, 'non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should find all pieces by their IDs', () => {
      const state = createInitialState(['A', 'B']);
      for (const piece of state.pieces) {
        const found = getPieceById(state, piece.id);
        expect(found).toBeDefined();
        expect(found).toEqual(piece);
      }
    });

    it('should return undefined for empty string ID', () => {
      const state = createInitialState(['A', 'B']);
      const found = getPieceById(state, '');
      expect(found).toBeUndefined();
    });

    it('should find Jarl pieces by ID', () => {
      const state = createInitialState(['A', 'B']);
      const jarls = state.pieces.filter((p) => p.type === 'jarl');

      for (const jarl of jarls) {
        const found = getPieceById(state, jarl.id);
        expect(found).toBeDefined();
        expect(found?.type).toBe('jarl');
        expect(found?.playerId).not.toBeNull();
      }
    });

    it('should find Warrior pieces by ID', () => {
      const state = createInitialState(['A', 'B']);
      const warriors = state.pieces.filter((p) => p.type === 'warrior');

      for (const warrior of warriors) {
        const found = getPieceById(state, warrior.id);
        expect(found).toBeDefined();
        expect(found?.type).toBe('warrior');
        expect(found?.playerId).not.toBeNull();
      }
    });

    it('should find Shield pieces by ID', () => {
      const state = createInitialState(['A', 'B']);
      const shields = state.pieces.filter((p) => p.type === 'shield');

      for (const shield of shields) {
        const found = getPieceById(state, shield.id);
        expect(found).toBeDefined();
        expect(found?.type).toBe('shield');
        expect(found?.playerId).toBeNull();
      }
    });

    it('should handle empty pieces array gracefully', () => {
      const state = createInitialState(['A', 'B']);
      const emptyState = { ...state, pieces: [] };
      const found = getPieceById(emptyState, 'any-id');
      expect(found).toBeUndefined();
    });

    it('should return exact piece object (same reference)', () => {
      const state = createInitialState(['A', 'B']);
      const piece = state.pieces[0];
      const found = getPieceById(state, piece.id);
      expect(found).toBe(piece); // Same reference
    });

    it('should work with different player counts', () => {
      for (let count = 2; count <= 6; count++) {
        const names = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
        const state = createInitialState(names);

        // Verify all pieces can be found by ID
        for (const piece of state.pieces) {
          const found = getPieceById(state, piece.id);
          expect(found).toBeDefined();
          expect(found?.id).toBe(piece.id);
        }
      }
    });
  });

  describe('isPathClear', () => {
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
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

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
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

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
            shieldCount: 0,
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

  describe('getDirectionBetweenAdjacent', () => {
    it('should return correct direction for adjacent hexes (East)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 1, r: 0 };
      expect(getDirectionBetweenAdjacent(from, to)).toBe(0);
    });

    it('should return correct direction for adjacent hexes (West)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: -1, r: 0 };
      expect(getDirectionBetweenAdjacent(from, to)).toBe(3);
    });

    it('should return correct direction for all 6 directions', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      // Direction 0 (East): q+1, r+0
      expect(getDirectionBetweenAdjacent(from, { q: 1, r: 0 })).toBe(0);
      // Direction 1 (Northeast): q+1, r-1
      expect(getDirectionBetweenAdjacent(from, { q: 1, r: -1 })).toBe(1);
      // Direction 2 (Northwest): q+0, r-1
      expect(getDirectionBetweenAdjacent(from, { q: 0, r: -1 })).toBe(2);
      // Direction 3 (West): q-1, r+0
      expect(getDirectionBetweenAdjacent(from, { q: -1, r: 0 })).toBe(3);
      // Direction 4 (Southwest): q-1, r+1
      expect(getDirectionBetweenAdjacent(from, { q: -1, r: 1 })).toBe(4);
      // Direction 5 (Southeast): q+0, r+1
      expect(getDirectionBetweenAdjacent(from, { q: 0, r: 1 })).toBe(5);
    });

    it('should return null for non-adjacent hexes', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 2, r: 0 }; // Distance 2
      expect(getDirectionBetweenAdjacent(from, to)).toBeNull();
    });

    it('should return null for same hex', () => {
      const from: AxialCoord = { q: 1, r: 2 };
      expect(getDirectionBetweenAdjacent(from, from)).toBeNull();
    });
  });

  describe('getLineDirection', () => {
    it('should return direction for hexes along q-axis (East)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 3, r: 0 };
      expect(getLineDirection(from, to)).toBe(0);
    });

    it('should return direction for hexes along q-axis (West)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: -3, r: 0 };
      expect(getLineDirection(from, to)).toBe(3);
    });

    it('should return direction for hexes along r-axis (Southeast)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 0, r: 3 };
      expect(getLineDirection(from, to)).toBe(5);
    });

    it('should return direction for hexes along r-axis (Northwest)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 0, r: -3 };
      expect(getLineDirection(from, to)).toBe(2);
    });

    it('should return direction for hexes along s-axis (Northeast)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 3, r: -3 };
      expect(getLineDirection(from, to)).toBe(1);
    });

    it('should return direction for hexes along s-axis (Southwest)', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: -3, r: 3 };
      expect(getLineDirection(from, to)).toBe(4);
    });

    it('should return null for non-straight-line positions', () => {
      const from: AxialCoord = { q: 0, r: 0 };
      const to: AxialCoord = { q: 2, r: 1 }; // Not on a straight line
      expect(getLineDirection(from, to)).toBeNull();
    });

    it('should return null for same position', () => {
      const from: AxialCoord = { q: 1, r: 2 };
      expect(getLineDirection(from, from)).toBeNull();
    });
  });

  // validateMove tests moved to __tests__/move-validation.test.ts
  // pathCrossesThrone tests moved to __tests__/move-validation.test.ts
  // Jarl 2-hex Throne crossing tests moved to __tests__/move-validation.test.ts

  // Combat strength tests (getPieceStrength, findInlineSupport, findBracing)
  // moved to __tests__/combat-strength.test.ts

  // Combat calculation tests (calculateAttack, calculateDefense, calculateCombat)
  // moved to __tests__/combat-calculation.test.ts

  // resolveSimplePush tests moved to __tests__/push-simple.test.ts

  // detectChain tests moved to __tests__/push-chain.test.ts
  // resolveEdgePush tests moved to __tests__/push-edge.test.ts
  // resolveCompression tests moved to __tests__/push-compression.test.ts
  // resolvePush tests moved to __tests__/push-resolution.test.ts

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

  describe('eliminatePlayer', () => {
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
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    describe('marks player as eliminated', () => {
      it('should mark the specified player as eliminated', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.newState.players[0].isEliminated).toBe(true);
        expect(result.newState.players[1].isEliminated).toBe(false);
      });

      it('should mark player 2 as eliminated', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p2');

        expect(result.newState.players[0].isEliminated).toBe(false);
        expect(result.newState.players[1].isEliminated).toBe(true);
      });
    });

    describe('removes all remaining Warriors', () => {
      it('should remove all Warriors belonging to eliminated player', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
          { id: 'p1-w3', type: 'warrior', playerId: 'p1', position: { q: 2, r: -1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        // P1's warriors should be removed
        expect(result.newState.pieces.find((p) => p.id === 'p1-w1')).toBeUndefined();
        expect(result.newState.pieces.find((p) => p.id === 'p1-w2')).toBeUndefined();
        expect(result.newState.pieces.find((p) => p.id === 'p1-w3')).toBeUndefined();
        // P2's pieces should remain
        expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeDefined();
      });

      it('should return removed piece IDs in result', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.removedPieceIds).toHaveLength(2);
        expect(result.removedPieceIds).toContain('p1-w1');
        expect(result.removedPieceIds).toContain('p1-w2');
      });

      it('should handle player with no remaining Warriors', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.removedPieceIds).toHaveLength(0);
        expect(result.newState.players[0].isEliminated).toBe(true);
      });
    });

    describe('generates ELIMINATED events', () => {
      it('should generate ELIMINATED event for each removed Warrior', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.events).toHaveLength(2);
        expect(result.events.every((e) => e.type === 'ELIMINATED')).toBe(true);
      });

      it('should include correct pieceId, playerId, and position in events', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.events).toHaveLength(1);
        const event = result.events[0];
        expect(event.type).toBe('ELIMINATED');
        if (event.type === 'ELIMINATED') {
          expect(event.pieceId).toBe('p1-w1');
          expect(event.playerId).toBe('p1');
          expect(event.position).toEqual({ q: 1, r: 0 });
          expect(event.cause).toBe('starvation');
        }
      });

      it('should generate no events when player has no Warriors', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result.events).toHaveLength(0);
      });
    });

    describe('player cannot take further turns', () => {
      it('should mark player as eliminated so they cannot take turns', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        // The isEliminated flag prevents the player from taking turns
        // (this is enforced by the turn logic, not this function)
        expect(result.newState.players[0].isEliminated).toBe(true);
      });
    });

    describe('handles edge cases', () => {
      it('should return unchanged state when player not found', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'nonexistent-player');

        expect(result.newState).toEqual(state);
        expect(result.events).toHaveLength(0);
        expect(result.removedPieceIds).toHaveLength(0);
      });

      it('should return unchanged state when player already eliminated', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          ],
        };

        const result = eliminatePlayer(state, 'p1');

        expect(result.newState).toEqual(state);
        expect(result.events).toHaveLength(0);
        expect(result.removedPieceIds).toHaveLength(0);
      });

      it('should not modify original state (immutability)', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);
        const originalPlayerCount = state.players.length;
        const originalPieceCount = state.pieces.length;
        const originalP1Eliminated = state.players[0].isEliminated;

        eliminatePlayer(state, 'p1');

        // Original state should be unchanged
        expect(state.players).toHaveLength(originalPlayerCount);
        expect(state.pieces).toHaveLength(originalPieceCount);
        expect(state.players[0].isEliminated).toBe(originalP1Eliminated);
      });
    });

    describe('does not remove shields', () => {
      it('should not remove shields when eliminating player', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'shield-1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
          { id: 'shield-2', type: 'shield', playerId: null, position: { q: 0, r: -1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        // Shields should remain
        expect(result.newState.pieces.find((p) => p.id === 'shield-1')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'shield-2')).toBeDefined();
      });
    });

    describe('preserves other players pieces', () => {
      it('should preserve all pieces belonging to other players', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
          { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 1 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        // P2's pieces should all remain
        expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'p2-w2')).toBeDefined();
        // Total pieces should be P2's pieces only
        expect(result.newState.pieces).toHaveLength(3);
      });
    });

    describe('multi-player scenarios', () => {
      it('should work correctly with 3 players', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p3-jarl', type: 'jarl', playerId: 'p3', position: { q: 0, r: 2 } },
          { id: 'p3-w1', type: 'warrior', playerId: 'p3', position: { q: 1, r: 1 } },
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: false },
          ],
        };

        const result = eliminatePlayer(state, 'p1');

        // P1 eliminated
        expect(result.newState.players[0].isEliminated).toBe(true);
        // P2 and P3 still active
        expect(result.newState.players[1].isEliminated).toBe(false);
        expect(result.newState.players[2].isEliminated).toBe(false);
        // P1's warrior removed
        expect(result.newState.pieces.find((p) => p.id === 'p1-w1')).toBeUndefined();
        // Others' pieces remain
        expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'p3-jarl')).toBeDefined();
        expect(result.newState.pieces.find((p) => p.id === 'p3-w1')).toBeDefined();
      });
    });

    describe('result structure', () => {
      it('should return correct structure with all fields', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = eliminatePlayer(state, 'p1');

        expect(result).toHaveProperty('newState');
        expect(result).toHaveProperty('events');
        expect(result).toHaveProperty('removedPieceIds');
        expect(Array.isArray(result.events)).toBe(true);
        expect(Array.isArray(result.removedPieceIds)).toBe(true);
      });
    });
  });

  describe('checkLastStanding', () => {
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
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    describe('returns winner ID when only one Jarl remains', () => {
      it('should return player 1 as winner when only their Jarl remains', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
      });

      it('should return player 2 as winner when only their Jarl remains', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p2');
      });

      it('should detect victory with only Jarl remaining (no warriors)', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
      });
    });

    describe('returns null if multiple Jarls exist', () => {
      it('should return no victory when both Jarls exist', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      });

      it('should return no victory when both Jarls exist with Warriors', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      });
    });

    describe('triggers immediately on last elimination', () => {
      it('should return victory immediately after eliminating opponent Jarl', () => {
        // Simulate state after opponent's Jarl was just eliminated
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          // p2's Jarl was just pushed off the edge, so only p1's pieces remain
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
      });
    });

    describe('handles multi-player scenarios', () => {
      it('should return no victory when 2 Jarls remain in 3-player game', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          // p3's Jarl was eliminated
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
          ],
        };

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      });

      it('should return victory when 1 Jarl remains in 3-player game', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
          // p1 and p3's Jarls were eliminated
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
          ],
        };

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p2');
      });
    });

    describe('handles edge cases', () => {
      it('should return no victory when no Jarls exist (edge case)', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      });

      it('should return no victory with empty pieces array', () => {
        const state = createTestState([]);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
      });

      it('should not count shields as Jarls', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'shield-1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
          { id: 'shield-2', type: 'shield', playerId: null, position: { q: 0, r: -1 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
      });

      it('should not count warriors as Jarls', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
          { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 1 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        // Only p1's Jarl exists, so p1 wins
        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
      });
    });

    describe('result structure', () => {
      it('should return correct structure for victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result).toHaveProperty('isVictory');
        expect(result).toHaveProperty('winnerId');
        expect(typeof result.isVictory).toBe('boolean');
        expect(typeof result.winnerId).toBe('string');
      });

      it('should return correct structure for no victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkLastStanding(state);

        expect(result).toHaveProperty('isVictory');
        expect(result).toHaveProperty('winnerId');
        expect(typeof result.isVictory).toBe('boolean');
        expect(result.winnerId).toBeNull();
      });
    });
  });

  describe('checkWinConditions', () => {
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
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    describe('checks throne victory first', () => {
      it('should return throne victory when Jarl voluntarily moves to throne', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
        expect(result.condition).toBe('throne');
      });

      it('should return player 2 throne victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 0, r: 0 } }, // On throne
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p2-jarl', true);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p2');
        expect(result.condition).toBe('throne');
      });
    });

    describe('checks last standing second', () => {
      it('should return last standing victory when only one Jarl remains', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          // p2's Jarl was just eliminated
        ];
        const state = createTestState(pieces);

        // The moved piece is not on throne, so throne check fails
        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
        expect(result.condition).toBe('lastStanding');
      });

      it('should return player 2 last standing victory', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          // p1's Jarl was just eliminated
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p2-jarl', true);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p2');
        expect(result.condition).toBe('lastStanding');
      });

      it('should return last standing even with involuntary move', () => {
        // If a push eliminated the opponent Jarl, last standing still triggers
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Involuntary move (pushed), but still checks last standing
        const result = checkWinConditions(state, 'p1-jarl', false);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
        expect(result.condition).toBe('lastStanding');
      });
    });

    describe('returns correct winner and condition', () => {
      it('should return no victory when both Jarls exist and no throne victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });

      it('should return no victory with involuntary throne entry', () => {
        // Pushed Jarl on throne doesn't count as victory (though compression prevents this)
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne but pushed
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', false); // involuntary

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });
    });

    describe('throne victory takes precedence over last standing', () => {
      it('should return throne victory when both conditions could trigger', () => {
        // Scenario: p1 moves Jarl to throne while also being the last Jarl
        // (opponent was already eliminated)
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne
          // p2's Jarl was eliminated earlier
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        // Throne takes precedence over last standing
        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p1');
        expect(result.condition).toBe('throne');
      });
    });

    describe('handles edge cases', () => {
      it('should return no victory when piece not found', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'nonexistent-piece', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });

      it('should return no victory when warrior moves (not Jarl)', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Warrior moves, not a Jarl - no throne victory possible
        const result = checkWinConditions(state, 'p1-w1', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });

      it('should return no victory with empty pieces array', () => {
        const state = createTestState([]);

        const result = checkWinConditions(state, 'nonexistent', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });
    });

    describe('multi-player scenarios', () => {
      it('should return no victory when 2 Jarls remain in 3-player game', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          // p3's Jarl was eliminated
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
          ],
        };

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });

      it('should return last standing victory when 1 Jarl remains in 3-player game', () => {
        const pieces: Piece[] = [
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
          // p1 and p3's Jarls were eliminated
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
          ],
        };

        const result = checkWinConditions(state, 'p2-jarl', true);

        expect(result.isVictory).toBe(true);
        expect(result.winnerId).toBe('p2');
        expect(result.condition).toBe('lastStanding');
      });
    });

    describe('result structure', () => {
      it('should return correct structure for throne victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result).toHaveProperty('isVictory');
        expect(result).toHaveProperty('winnerId');
        expect(result).toHaveProperty('condition');
        expect(typeof result.isVictory).toBe('boolean');
        expect(typeof result.winnerId).toBe('string');
        expect(result.condition).toBe('throne');
      });

      it('should return correct structure for last standing victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result).toHaveProperty('isVictory');
        expect(result).toHaveProperty('winnerId');
        expect(result).toHaveProperty('condition');
        expect(typeof result.isVictory).toBe('boolean');
        expect(typeof result.winnerId).toBe('string');
        expect(result.condition).toBe('lastStanding');
      });

      it('should return correct structure for no victory', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = checkWinConditions(state, 'p1-jarl', true);

        expect(result).toHaveProperty('isVictory');
        expect(result).toHaveProperty('winnerId');
        expect(result).toHaveProperty('condition');
        expect(result.isVictory).toBe(false);
        expect(result.winnerId).toBeNull();
        expect(result.condition).toBeNull();
      });
    });
  });

  // Move execution tests (getReachableHexes, getValidMoves, applyMove) moved to:
  // __tests__/move-execution.test.ts
  // __tests__/apply-move.test.ts
});
