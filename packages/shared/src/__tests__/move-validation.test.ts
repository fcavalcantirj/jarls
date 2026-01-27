import {
  isOnBoardAxial,
  createInitialState,
  getPieceAt,
  getPieceById,
  pathCrossesThrone,
  validateMove,
  applyMove,
  AxialCoord,
  GameState,
  Piece,
  MoveCommand,
} from '../index';

describe('Move Validation', () => {
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
        firstPlayerIndex: 0,
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
        firstPlayerIndex: 0,
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

  describe('friendly piece blocking', () => {
    function createFriendlyBlockingTestState(pieces: Piece[], currentPlayerId: string): GameState {
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
        currentPlayerId,
        turnNumber: 1,
        roundNumber: 1,
        firstPlayerIndex: 0,
        roundsSinceElimination: 0,
        winnerId: null,
        winCondition: null,
      };
    }

    it('should not allow a warrior to move through own warrior', () => {
      // p1 warrior at (0,1), own warrior at (1,0) blocking path to (2,0)
      // Warrior at (0,1) tries to move East 2 hexes to (2,0), but (1,0) has own warrior
      const state = createFriendlyBlockingTestState(
        [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } }, // Blocking
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: -1 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'w1', destination: { q: 3, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PATH_BLOCKED');
    });

    it('should not allow a warrior to land on own warrior', () => {
      // p1 warrior at (1,0), own warrior at (2,0) at destination
      const state = createFriendlyBlockingTestState(
        [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } }, // At destination
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: -1 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('DESTINATION_OCCUPIED_FRIENDLY');
    });

    it('should not allow a jarl to move through own warrior', () => {
      // p1 jarl at (0,1) with draft in East direction, own warrior at (1,1) blocking
      const state = createFriendlyBlockingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } }, // Blocking path East
          // Draft formation behind jarl (West direction = opposite of East)
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
          { id: 'w3', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'j1', destination: { q: 3, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PATH_BLOCKED');
    });

    it('should not allow a jarl to land on own warrior', () => {
      const state = createFriendlyBlockingTestState(
        [
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } }, // At destination
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      const command: MoveCommand = { pieceId: 'j1', destination: { q: 2, r: 0 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('DESTINATION_OCCUPIED_FRIENDLY');
    });

    it('should allow moving to hex adjacent to own warrior (not through it)', () => {
      // p1 warrior at (1,0), own warrior at (2,0). Can move to (2,-1) which is not blocked.
      const state = createFriendlyBlockingTestState(
        [
          { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
          { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
          { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -1, r: -1 } },
          { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        ],
        'p1'
      );

      // Move in a different direction (NE) which is not blocked
      const command: MoveCommand = { pieceId: 'w1', destination: { q: 2, r: -1 } };
      const result = validateMove(state, 'p1', command);

      expect(result.isValid).toBe(true);
    });
  });
});
