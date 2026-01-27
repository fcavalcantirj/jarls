import {
  isOnBoardAxial,
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
  pathCrossesThrone,
  validateMove,
  calculateCombat,
  checkThroneVictory,
  eliminatePlayer,
  checkLastStanding,
  checkWinConditions,
  getReachableHexes,
  getValidMoves,
  applyMove,
  AxialCoord,
  GameConfig,
  GameState,
  Piece,
  MoveCommand,
  MoveEvent,
  PushEvent,
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

  describe('validateMove', () => {
    // Helper to create a test game state
    function createValidateMoveTestState(
      pieces: Piece[],
      currentPlayerId: string,
      phase: 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended' = 'playing'
    ): GameState {
      return {
        id: 'test-game',
        phase,
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
        currentPlayerId,
        turnNumber: 1,
        roundNumber: 1,
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    describe('validates piece exists and belongs to player', () => {
      it('should return PIECE_NOT_FOUND when piece does not exist', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'nonexistent', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('PIECE_NOT_FOUND');
      });

      it('should return NOT_YOUR_PIECE when piece belongs to another player', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w2', destination: { q: -2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('NOT_YOUR_PIECE');
      });
    });

    describe("validates it's player's turn", () => {
      it('should return NOT_YOUR_TURN when it is not the player turn', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p2' // p2's turn, not p1's
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('NOT_YOUR_TURN');
      });
    });

    describe('validates game is in playing phase', () => {
      it('should return GAME_NOT_PLAYING when game is in lobby phase', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1',
          'lobby'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('GAME_NOT_PLAYING');
      });

      it('should return GAME_NOT_PLAYING when game is in setup phase', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1',
          'setup'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('GAME_NOT_PLAYING');
      });

      it('should return GAME_NOT_PLAYING when game is ended', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1',
          'ended'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('GAME_NOT_PLAYING');
      });
    });

    describe('validates destination distance for piece type', () => {
      it('should allow Warrior to move 1 hex', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(false);
      });

      it('should allow Warrior to move 2 hexes with momentum', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(true);
      });

      it('should not allow Warrior to move 3 hexes', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('INVALID_DISTANCE_WARRIOR');
      });

      it('should allow Jarl to move 1 hex without draft', () => {
        const state = createValidateMoveTestState(
          [{ id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(false);
      });

      it('should not allow Jarl to move 3 hexes', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('INVALID_DISTANCE_JARL');
      });
    });

    describe('validates path is clear', () => {
      it('should return PATH_BLOCKED when piece blocks path', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('PATH_BLOCKED');
      });

      it('should return PATH_BLOCKED when shield blocks path', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
            { id: 's1', type: 'shield', playerId: null, position: { q: 2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('PATH_BLOCKED');
      });

      it('should allow move when path is clear', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validates Jarl draft for 2-hex move', () => {
      it('should not allow Jarl to move 2 hexes without draft formation', () => {
        const state = createValidateMoveTestState(
          [{ id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('JARL_NEEDS_DRAFT_FOR_TWO_HEX');
      });

      it('should allow Jarl to move 2 hexes with draft formation', () => {
        // Jarl at (0, 0) moving East (direction 0)
        // Needs 2+ Warriors behind in direction 3 (West)
        const state = createValidateMoveTestState(
          [
            { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(true);
      });

      it('should not allow Jarl 2-hex move when draft is in wrong direction', () => {
        // Jarl at (0, 0) trying to move Southeast (direction 5: q+0, r+2)
        // Warriors are positioned behind for East movement (West side)
        // But Southeast requires draft behind in Northwest direction
        const state = createValidateMoveTestState(
          [
            { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } }, // West
            { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } }, // Further West
          ],
          'p1'
        );
        // Try to move Southeast (direction 5) - 2 hexes
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 0, r: 2 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('JARL_NEEDS_DRAFT_FOR_TWO_HEX');
      });
    });

    describe('validates Warriors cannot enter Throne', () => {
      it('should return WARRIOR_CANNOT_ENTER_THRONE when Warrior tries to enter Throne', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 0, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('WARRIOR_CANNOT_ENTER_THRONE');
      });

      it('should allow Jarl to enter Throne', () => {
        const state = createValidateMoveTestState(
          [{ id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 0, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validates cannot land on friendly piece', () => {
      it('should return DESTINATION_OCCUPIED_FRIENDLY when landing on friendly piece', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('DESTINATION_OCCUPIED_FRIENDLY');
      });

      it('should allow landing on enemy piece (attack)', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validates destination is on board', () => {
      it('should return DESTINATION_OFF_BOARD when moving off board', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 4, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('DESTINATION_OFF_BOARD');
      });
    });

    describe('validates move is in straight line', () => {
      it('should return MOVE_NOT_STRAIGHT_LINE for non-straight moves', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } }],
          'p1'
        );
        // Diagonal-ish move that is not in hex straight line
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 1 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('MOVE_NOT_STRAIGHT_LINE');
      });
    });

    describe('validates shields cannot move', () => {
      it('should return SHIELD_CANNOT_MOVE when trying to move a shield', () => {
        const state = createValidateMoveTestState(
          [{ id: 's1', type: 'shield', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 's1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('SHIELD_CANNOT_MOVE');
      });
    });

    describe('hasMomentum flag', () => {
      it('should set hasMomentum to true for 2-hex Warrior move', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(true);
      });

      it('should set hasMomentum to false for 1-hex Warrior move', () => {
        const state = createValidateMoveTestState(
          [{ id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } }],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(false);
      });

      it('should set hasMomentum to true for 2-hex Jarl draft move', () => {
        const state = createValidateMoveTestState(
          [
            { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
            { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
            { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          ],
          'p1'
        );
        const command: MoveCommand = { pieceId: 'j1', destination: { q: 2, r: 0 } };
        const result = validateMove(state, 'p1', command);
        expect(result.isValid).toBe(true);
        expect(result.hasMomentum).toBe(true);
      });
    });

    describe('game scenario tests', () => {
      it('should validate move in realistic game state', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.phase = 'playing';
        // Find a warrior belonging to the current player
        const warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.currentPlayerId
        );
        expect(warrior).toBeDefined();
        if (!warrior) return;

        // Try to move 1 hex in some direction (find a valid destination)
        const directions = [
          { q: 1, r: 0 },
          { q: 0, r: 1 },
          { q: -1, r: 0 },
          { q: 0, r: -1 },
          { q: 1, r: -1 },
          { q: -1, r: 1 },
        ];

        let foundValidMove = false;
        for (const dir of directions) {
          const dest: AxialCoord = {
            q: warrior.position.q + dir.q,
            r: warrior.position.r + dir.r,
          };
          if (!isOnBoardAxial(dest, state.config.boardRadius)) continue;
          const existingPiece = getPieceAt(state, dest);
          if (existingPiece && existingPiece.playerId === state.currentPlayerId) continue;
          if (dest.q === 0 && dest.r === 0) continue; // Throne

          const command: MoveCommand = { pieceId: warrior.id, destination: dest };
          const result = validateMove(state, state.currentPlayerId!, command);
          if (result.isValid) {
            foundValidMove = true;
            break;
          }
        }
        // In most initial states, warriors should have at least one valid move
        expect(foundValidMove).toBe(true);
      });
    });
  });

  describe('pathCrossesThrone', () => {
    it('should return null when path does not cross Throne', () => {
      // Path from (1,0) to (3,0) - East direction, doesn't cross origin
      const result = pathCrossesThrone({ q: 1, r: 0 }, { q: 3, r: 0 });
      expect(result).toBeNull();
    });

    it('should return null for 1-hex move', () => {
      // 1-hex move has no intermediate hexes to cross
      const result = pathCrossesThrone({ q: -1, r: 0 }, { q: 0, r: 0 });
      expect(result).toBeNull();
    });

    it('should return Throne position when path crosses through Throne', () => {
      // Path from (-2,0) to (2,0) - crosses origin (but this is 4 hexes, let's use 2-hex)
      // For 2-hex move crossing throne: (-1,0) to (1,0)
      const result = pathCrossesThrone({ q: -1, r: 0 }, { q: 1, r: 0 });
      expect(result).toEqual({ q: 0, r: 0 });
    });

    it('should detect crossing in Northeast-Southwest direction', () => {
      // Path from (-1,1) to (1,-1) crosses (0,0)
      const result = pathCrossesThrone({ q: -1, r: 1 }, { q: 1, r: -1 });
      expect(result).toEqual({ q: 0, r: 0 });
    });

    it('should detect crossing in Northwest-Southeast direction', () => {
      // Path from (1,1) to (-1,-1) crosses (0,0)
      const result = pathCrossesThrone({ q: 1, r: -1 }, { q: -1, r: 1 });
      expect(result).toEqual({ q: 0, r: 0 });
    });

    it('should return null when Throne is the destination (not intermediate)', () => {
      // Moving TO the Throne is not "crossing" it
      const result = pathCrossesThrone({ q: -2, r: 0 }, { q: 0, r: 0 });
      expect(result).toBeNull();
    });

    it('should return null when Throne is the start (not intermediate)', () => {
      // Moving FROM the Throne is not "crossing" it
      const result = pathCrossesThrone({ q: 0, r: 0 }, { q: 2, r: 0 });
      expect(result).toBeNull();
    });
  });

  describe('Jarl 2-hex Throne crossing', () => {
    // Helper to create a test game state for Jarl throne crossing tests
    function createJarlThroneCrossingTestState(
      pieces: Piece[],
      currentPlayerId: string
    ): GameState {
      return {
        id: 'test-game',
        phase: 'playing',
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
        currentPlayerId,
        turnNumber: 1,
        roundNumber: 1,
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    it('should set adjustedDestination when Jarl 2-hex move crosses Throne', () => {
      // Jarl at (-1,0) with 2 warriors behind at (-2,0) and (-3,0) for draft
      // Attempting to move to (1,0) which crosses the Throne
      const state = createJarlThroneCrossingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'j1', destination: { q: 1, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(true);
      expect(result.hasMomentum).toBe(true);
      expect(result.adjustedDestination).toEqual({ q: 0, r: 0 });
    });

    it('should not set adjustedDestination when Jarl 2-hex move does not cross Throne', () => {
      // Jarl at (1,0) with 2 warriors behind in West direction, moving to (3,0) - doesn't cross Throne
      const stateWithDraft = createJarlThroneCrossingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } }, // Behind (West)
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } }, // Further behind
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'j1', destination: { q: 3, r: 0 } };
      const result = validateMove(stateWithDraft, 'p1', command);

      expect(result.isValid).toBe(true);
      expect(result.hasMomentum).toBe(true);
      expect(result.adjustedDestination).toBeUndefined();
    });

    it('should not set adjustedDestination for 1-hex Jarl moves', () => {
      // 1-hex move cannot cross through Throne (only TO or FROM it)
      const state = createJarlThroneCrossingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 3, r: 0 } },
        ],
        'p1'
      );

      // Move to Throne (1-hex move TO throne, not crossing)
      const command: MoveCommand = { pieceId: 'j1', destination: { q: 0, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(true);
      expect(result.hasMomentum).toBe(false);
      expect(result.adjustedDestination).toBeUndefined();
    });

    it('should trigger throne victory when Jarl 2-hex move crosses Throne via applyMove', () => {
      // Full integration test: Jarl's 2-hex move crossing Throne should result in victory
      const state = createJarlThroneCrossingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: -3, r: 0 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 3, r: 0 } },
        ],
        'p1'
      );

      // Attempt to move to (1,0) - should stop at Throne and win
      const command: MoveCommand = { pieceId: 'j1', destination: { q: 1, r: 0 } };
      const result = applyMove(state, 'p1', command);

      expect(result.success).toBe(true);
      expect(result.newState.phase).toBe('ended');
      expect(result.newState.winnerId).toBe('p1');
      expect(result.newState.winCondition).toBe('throne');

      // Jarl should be at the Throne, not at the original destination
      const jarl = getPieceById(result.newState, 'j1');
      expect(jarl?.position).toEqual({ q: 0, r: 0 });
    });

    it('should work correctly with diagonal 2-hex Throne crossing', () => {
      // Jarl at (1,-1) moving to (-1,1) with draft, crosses Throne
      const state = createJarlThroneCrossingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: -1 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: -2 } }, // Behind in SW direction
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 3, r: -3 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'j1', destination: { q: -1, r: 1 } };
      const result = applyMove(state, 'p1', command);

      expect(result.success).toBe(true);
      expect(result.newState.winnerId).toBe('p1');
      expect(result.newState.winCondition).toBe('throne');

      const jarl = getPieceById(result.newState, 'j1');
      expect(jarl?.position).toEqual({ q: 0, r: 0 });
    });
  });

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

  describe('applyMove', () => {
    function createTestState(
      pieces: Piece[],
      options: {
        currentPlayerId?: string;
        phase?: 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';
      } = {}
    ): GameState {
      return {
        id: 'test-game',
        phase: options.phase ?? 'playing',
        config: {
          playerCount: 2,
          boardRadius: 3,
          shieldCount: 0,
          warriorCount: 5,
          turnTimerMs: null,
        },
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
        ],
        pieces,
        currentPlayerId: options.currentPlayerId ?? 'p1',
        turnNumber: 0,
        roundNumber: 0,
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    describe('validation', () => {
      it('should return error when move is invalid', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Try to move p2's piece when it's p1's turn
        const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

        expect(result.success).toBe(false);
        expect(result.error).toBe('NOT_YOUR_TURN');
        expect(result.newState).toBe(state); // Same state reference
        expect(result.events).toHaveLength(0);
      });

      it('should return error when game is not in playing phase', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces, { phase: 'lobby' });

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        expect(result.success).toBe(false);
        expect(result.error).toBe('GAME_NOT_PLAYING');
      });

      it('should return error when piece does not exist', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', {
          pieceId: 'nonexistent',
          destination: { q: 2, r: 0 },
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('PIECE_NOT_FOUND');
      });
    });

    describe('simple move (no combat)', () => {
      it('should move piece to empty hex', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        // Check piece moved
        const movedPiece = result.newState.pieces.find((p) => p.id === 'p1-jarl');
        expect(movedPiece!.position).toEqual({ q: 2, r: 0 });
      });

      it('should generate MOVE event for simple move', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        expect(result.success).toBe(true);
        const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
        expect(moveEvent).toBeDefined();
        expect(moveEvent.pieceId).toBe('p1-jarl');
        expect(moveEvent.from).toEqual({ q: 3, r: 0 });
        expect(moveEvent.to).toEqual({ q: 2, r: 0 });
        expect(moveEvent.hasMomentum).toBe(false);
      });

      it('should set hasMomentum true for 2-hex move', () => {
        // Warrior at (3,0) moves 2 hexes to (1,0) - path is clear
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 3 } }, // Out of the way
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

        expect(result.success).toBe(true);
        const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
        expect(moveEvent.hasMomentum).toBe(true);
      });

      it('should advance turn to next player', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.currentPlayerId).toBe('p2');
        expect(result.newState.turnNumber).toBe(1);
      });

      it('should generate TURN_ENDED event', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        const turnEndedEvent = result.events.find((e) => e.type === 'TURN_ENDED');
        expect(turnEndedEvent).toBeDefined();
        expect((turnEndedEvent as any).playerId).toBe('p1');
        expect((turnEndedEvent as any).nextPlayerId).toBe('p2');
        expect((turnEndedEvent as any).turnNumber).toBe(1);
      });
    });

    describe('attack with push', () => {
      it('should push defender when attack succeeds', () => {
        // Jarl attacking Warrior (2 vs 1 = push)
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        // First verify calculateCombat directly works
        const combatResult = calculateCombat(
          state,
          pieces[0], // p1-jarl
          { q: 2, r: 0 }, // attacker position
          pieces[1], // p2-w1
          { q: 1, r: 0 }, // defender position
          3, // West direction
          false // no momentum
        );
        expect(combatResult.attack.total).toBe(2);
        expect(combatResult.defense.total).toBe(1);
        expect(combatResult.outcome).toBe('push');

        // Now test applyMove
        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 1, r: 0 } });

        expect(result.success).toBe(true);

        // Attacker should be at defender's original position
        const attacker = result.newState.pieces.find((p) => p.id === 'p1-jarl');
        expect(attacker!.position).toEqual({ q: 1, r: 0 });

        // Defender should be pushed West
        const defender = result.newState.pieces.find((p) => p.id === 'p2-w1');
        expect(defender!.position).toEqual({ q: 0, r: 0 }); // Pushed to throne (Warriors can be pushed there)
      });

      it('should generate MOVE and PUSH events for successful push', () => {
        // Same setup as above - 2-hex move for momentum
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 3 } }, // Out of the way
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

        expect(result.success).toBe(true);

        const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
        expect(moveEvent).toBeDefined();
        expect(moveEvent.pieceId).toBe('p1-w1');

        const pushEvent = result.events.find((e) => e.type === 'PUSH') as PushEvent;
        expect(pushEvent).toBeDefined();
        expect(pushEvent.pieceId).toBe('p2-w1');
        expect(pushEvent.from).toEqual({ q: 1, r: 0 });
        expect(pushEvent.to).toEqual({ q: 0, r: 0 });
      });

      it('should eliminate piece pushed off edge', () => {
        // Warrior at edge, being pushed off
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } }, // On edge
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Attack: 1 (base) + 2 (Jarl support) = 3 vs 1 = push
        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 3, r: 0 } });

        expect(result.success).toBe(true);

        // Defender should be eliminated
        const defender = result.newState.pieces.find((p) => p.id === 'p2-w1');
        expect(defender).toBeUndefined();

        // Check for ELIMINATED event
        const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
        expect(eliminatedEvent).toBeDefined();
        expect((eliminatedEvent as any).pieceId).toBe('p2-w1');
        expect((eliminatedEvent as any).cause).toBe('edge');
      });

      it('should reset roundsSinceElimination when piece is eliminated', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = {
          ...createTestState(pieces),
          roundsSinceElimination: 5,
        };

        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 3, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.roundsSinceElimination).toBe(0);
      });
    });

    describe('blocked attack', () => {
      it('should stop attacker adjacent to defender when attack is blocked', () => {
        // Warrior attacking Jarl (1 vs 2 = blocked)
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Attack: 1 (base) vs 2 (Jarl defense) = blocked
        // 2-hex move: from (3,0) to (1,0) would normally end at enemy position
        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

        expect(result.success).toBe(true);

        // Attacker should stop adjacent to defender
        const attacker = result.newState.pieces.find((p) => p.id === 'p1-w1');
        expect(attacker!.position).toEqual({ q: 2, r: 0 }); // One hex before destination

        // Defender should not move
        const defender = result.newState.pieces.find((p) => p.id === 'p2-jarl');
        expect(defender!.position).toEqual({ q: 1, r: 0 });
      });

      it('should generate only MOVE event when attack is blocked', () => {
        const pieces: Piece[] = [
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: 1, r: 0 } });

        expect(result.success).toBe(true);

        const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
        expect(moveEvent).toBeDefined();
        expect(moveEvent.to).toEqual({ q: 2, r: 0 }); // Stopped adjacent

        // No PUSH event
        const pushEvent = result.events.find((e) => e.type === 'PUSH');
        expect(pushEvent).toBeUndefined();
      });
    });

    describe('win conditions', () => {
      it('should detect throne victory when Jarl moves to throne', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        // Jarl moves to throne
        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.phase).toBe('ended');
        expect(result.newState.winnerId).toBe('p1');
        expect(result.newState.winCondition).toBe('throne');

        // Check for GAME_ENDED event
        const gameEndedEvent = result.events.find((e) => e.type === 'GAME_ENDED');
        expect(gameEndedEvent).toBeDefined();
        expect((gameEndedEvent as any).winnerId).toBe('p1');
        expect((gameEndedEvent as any).winCondition).toBe('throne');
      });

      it('should not advance turn when game ends', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } });

        expect(result.success).toBe(true);
        // No TURN_ENDED event
        const turnEndedEvent = result.events.find((e) => e.type === 'TURN_ENDED');
        expect(turnEndedEvent).toBeUndefined();
      });

      it('should detect last standing victory when only one Jarl remains', () => {
        // p1's warrior pushes p2's Jarl off edge
        // Attack: 1 (base) + 2 (Jarl support from behind) would only work if Jarl is behind
        // Let's position it properly
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } }, // Support from behind
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } }, // On edge
        ];
        const state = createTestState(pieces);

        // Attack: 1 (warrior) + 2 (Jarl support) = 3 vs 2 (Jarl defense) = push off edge
        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: -3, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.phase).toBe('ended');
        expect(result.newState.winnerId).toBe('p1');
        expect(result.newState.winCondition).toBe('lastStanding');
      });

      it('should eliminate player and their remaining warriors when Jarl dies', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 0, r: -3 } }, // Far away
        ];
        const state = createTestState(pieces);

        const result = applyMove(state, 'p1', { pieceId: 'p1-w1', destination: { q: -3, r: 0 } });

        expect(result.success).toBe(true);

        // p2's Jarl should be eliminated
        expect(result.newState.pieces.find((p) => p.id === 'p2-jarl')).toBeUndefined();

        // p2's remaining warrior should also be eliminated
        expect(result.newState.pieces.find((p) => p.id === 'p2-w1')).toBeUndefined();

        // p2 should be marked as eliminated
        const p2 = result.newState.players.find((p) => p.id === 'p2');
        expect(p2!.isEliminated).toBe(true);
      });
    });

    describe('turn management', () => {
      it('should skip eliminated players in turn order', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          // p2 is eliminated
        ];
        const state: GameState = {
          ...createTestState(pieces),
          players: [
            { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
            { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: true },
            { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: false },
          ],
          config: {
            playerCount: 3,
            boardRadius: 5,
            shieldCount: 0,
            warriorCount: 5,
            turnTimerMs: null,
          },
        };
        state.pieces.push({
          id: 'p3-jarl',
          type: 'jarl',
          playerId: 'p3',
          position: { q: -3, r: 0 },
        });

        const result = applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        expect(result.success).toBe(true);
        // Should skip p2 and go to p3
        expect(result.newState.currentPlayerId).toBe('p3');
      });

      it('should increment round number when turn cycles back to first player', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces, { currentPlayerId: 'p2' });
        state.roundNumber = 5;
        state.turnNumber = 10;

        const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.currentPlayerId).toBe('p1'); // Back to first player
        expect(result.newState.roundNumber).toBe(6); // Round incremented
        expect(result.newState.turnNumber).toBe(11);
      });

      it('should increment roundsSinceElimination on new round without elimination', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces, { currentPlayerId: 'p2' });
        state.roundsSinceElimination = 3;

        const result = applyMove(state, 'p2', { pieceId: 'p2-jarl', destination: { q: -2, r: 0 } });

        expect(result.success).toBe(true);
        expect(result.newState.roundsSinceElimination).toBe(4);
      });
    });

    describe('state immutability', () => {
      it('should not modify the original state', () => {
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ];
        const state = createTestState(pieces);
        const originalPiecePosition = { ...state.pieces[0].position };
        const originalCurrentPlayer = state.currentPlayerId;

        applyMove(state, 'p1', { pieceId: 'p1-jarl', destination: { q: 2, r: 0 } });

        // Original state should be unchanged
        expect(state.pieces[0].position).toEqual(originalPiecePosition);
        expect(state.currentPlayerId).toBe(originalCurrentPlayer);
      });
    });

    describe('game scenarios', () => {
      it('should handle realistic game state', () => {
        const state = createInitialState(['Alice', 'Bob']);
        state.phase = 'playing';

        // Find a warrior for p1
        const p1Warrior = state.pieces.find(
          (p) => p.type === 'warrior' && p.playerId === state.players[0].id
        );
        expect(p1Warrior).toBeDefined();

        // Get valid moves for this warrior
        const validMoves = getValidMoves(state, p1Warrior!.id);
        expect(validMoves.length).toBeGreaterThan(0);

        // Apply the first valid move
        const result = applyMove(state, state.players[0].id, {
          pieceId: p1Warrior!.id,
          destination: validMoves[0].destination,
        });

        expect(result.success).toBe(true);
        expect(result.newState.currentPlayerId).toBe(state.players[1].id);
      });
    });
  });
});
