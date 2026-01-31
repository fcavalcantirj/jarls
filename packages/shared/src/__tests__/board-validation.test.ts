import {
  hexDistanceAxial,
  isOnBoardAxial,
  isOnEdgeAxial,
  hexToKey,
  getConfigForPlayerCount,
  getDirectionTowardThrone,
  placeWarriors,
  generateId,
  createInitialState,
  getNeighbor,
  axialToCube,
  hexDistance,
  AxialCoord,
  CubeCoord,
} from '../index';

describe('board validation', () => {
  describe('getDirectionTowardThrone', () => {
    it('should return East (0) from West edge', () => {
      const direction = getDirectionTowardThrone({ q: -3, r: 0 });
      expect(direction).toBe(0); // East
    });

    it('should return West (3) from East edge', () => {
      const direction = getDirectionTowardThrone({ q: 3, r: 0 });
      expect(direction).toBe(3); // West
    });

    it('should return Southwest (4) from Northeast edge', () => {
      const direction = getDirectionTowardThrone({ q: 2, r: -2 });
      expect(direction).toBe(4); // Southwest
    });

    it('should return Northeast (1) from Southwest edge', () => {
      const direction = getDirectionTowardThrone({ q: -2, r: 2 });
      expect(direction).toBe(1); // Northeast
    });

    it('should return a direction that decreases distance to throne', () => {
      const start: AxialCoord = { q: 3, r: 0 };
      const direction = getDirectionTowardThrone(start);
      const startCube = axialToCube(start);
      const throne: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(startCube, direction);

      const distBefore = hexDistance(startCube, throne);
      const distAfter = hexDistance(neighbor, throne);

      expect(distAfter).toBeLessThan(distBefore);
    });
  });

  describe('placeWarriors', () => {
    describe('basic placement', () => {
      it('should place correct number of warriors', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        expect(warriors).toHaveLength(5);
      });

      it('should return empty array for zero warriors', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 0, holePositions, 3);
        expect(warriors).toHaveLength(0);
      });

      it('should return empty array for negative warrior count', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, -1, holePositions, 3);
        expect(warriors).toHaveLength(0);
      });

      it('should place warriors at unique positions', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        const keys = warriors.map(hexToKey);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(warriors.length);
      });
    });

    describe('position constraints', () => {
      it('should not place warriors on the Jarl position', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        const jarlKey = hexToKey(jarlPosition);
        warriors.forEach((warrior) => {
          expect(hexToKey(warrior)).not.toBe(jarlKey);
        });
      });

      it('should not place warriors on the Throne', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        const throneKey = hexToKey({ q: 0, r: 0 });
        warriors.forEach((warrior) => {
          expect(hexToKey(warrior)).not.toBe(throneKey);
        });
      });

      it('should not place warriors on hole positions', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>([hexToKey({ q: 2, r: 0 }), hexToKey({ q: 1, r: 0 })]);
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        warriors.forEach((warrior) => {
          expect(holePositions.has(hexToKey(warrior))).toBe(false);
        });
      });

      it('should place warriors within board bounds', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
        });
      });
    });

    describe('formation toward throne', () => {
      it('should place warriors between Jarl and Throne', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 3, holePositions, 3);
        const throne: AxialCoord = { q: 0, r: 0 };
        const jarlDistance = hexDistanceAxial(jarlPosition, throne);

        // Warriors should be closer to throne than the Jarl
        // (or at least some of them should be on the path)
        let hasWarriorOnPath = false;
        warriors.forEach((warrior) => {
          const warriorDistance = hexDistanceAxial(warrior, throne);
          if (warriorDistance < jarlDistance) {
            hasWarriorOnPath = true;
          }
        });
        expect(hasWarriorOnPath).toBe(true);
      });

      it('should place warriors in a line formation toward center when path is clear', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 2, holePositions, 3);

        // With path from (3,0) to (0,0), warriors should be at (2,0) and (1,0)
        const expectedPositions = [hexToKey({ q: 2, r: 0 }), hexToKey({ q: 1, r: 0 })];
        const actualKeys = warriors.map(hexToKey);

        expect(actualKeys).toContain(expectedPositions[0]);
        expect(actualKeys).toContain(expectedPositions[1]);
      });
    });

    describe('hole avoidance', () => {
      it('should place warriors around holes', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        // Block direct path
        const holePositions = new Set<string>([hexToKey({ q: 2, r: 0 })]);
        const warriors = placeWarriors(jarlPosition, 5, holePositions, 3);

        // Should still place correct number of warriors
        expect(warriors).toHaveLength(5);

        // Warriors should not be on hole position
        warriors.forEach((warrior) => {
          expect(holePositions.has(hexToKey(warrior))).toBe(false);
        });
      });

      it('should place warriors on alternate hexes when direct path is blocked', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        // Block most of the direct path
        const holePositions = new Set<string>([hexToKey({ q: 2, r: 0 }), hexToKey({ q: 1, r: 0 })]);
        // With 2 hexes blocked on direct path, only 4 warriors can be placed near the Jarl
        // in a radius 3 board (limited neighbor hexes available)
        const warriors = placeWarriors(jarlPosition, 4, holePositions, 3);

        // Should place the requested number of warriors
        expect(warriors).toHaveLength(4);

        // Warriors should be on board and not on holes
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
          expect(holePositions.has(hexToKey(warrior))).toBe(false);
        });
      });
    });

    describe('game scenarios', () => {
      it('should work with standard 2-player East edge Jarl', () => {
        const config = getConfigForPlayerCount(2);
        const jarlPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        const holePositions = new Set<string>();
        const warriors = placeWarriors(
          jarlPosition,
          config.warriorCount,
          holePositions,
          config.boardRadius
        );
        expect(warriors).toHaveLength(config.warriorCount);
      });

      it('should work with standard 2-player West edge Jarl', () => {
        const config = getConfigForPlayerCount(2);
        const jarlPosition: AxialCoord = { q: -3, r: 0 }; // West edge
        const holePositions = new Set<string>();
        const warriors = placeWarriors(
          jarlPosition,
          config.warriorCount,
          holePositions,
          config.boardRadius
        );
        expect(warriors).toHaveLength(config.warriorCount);
      });

      it('should work with diagonal starting positions', () => {
        const jarlPosition: AxialCoord = { q: 2, r: -2 }; // NE area
        const holePositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 4, holePositions, 3);
        expect(warriors).toHaveLength(4);

        // All warriors should be on board
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
        });
      });
    });
  });

  describe('generateId', () => {
    it('should generate a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should contain a hyphen separator', () => {
      const id = generateId();
      expect(id).toContain('-');
    });
  });

  describe('createInitialState', () => {
    describe('basic creation', () => {
      it('should create a GameState object with all required fields', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state).toHaveProperty('id');
        expect(state).toHaveProperty('phase');
        expect(state).toHaveProperty('config');
        expect(state).toHaveProperty('players');
        expect(state).toHaveProperty('pieces');
        expect(state).toHaveProperty('holes');
        expect(state).toHaveProperty('currentPlayerId');
        expect(state).toHaveProperty('turnNumber');
        expect(state).toHaveProperty('roundNumber');
        expect(state).toHaveProperty('roundsSinceElimination');
        expect(state).toHaveProperty('winnerId');
        expect(state).toHaveProperty('winCondition');
      });

      it('should set phase to setup', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.phase).toBe('setup');
      });

      it('should generate a unique game ID', () => {
        const state1 = createInitialState(['Player 1', 'Player 2']);
        const state2 = createInitialState(['Player 1', 'Player 2']);
        expect(state1.id).not.toBe(state2.id);
      });

      it('should initialize counters to zero', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.turnNumber).toBe(0);
        expect(state.roundNumber).toBe(0);
        expect(state.roundsSinceElimination).toBe(0);
      });

      it('should initialize winner to null', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.winnerId).toBeNull();
        expect(state.winCondition).toBeNull();
      });

      it('should set first player as current player', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.currentPlayerId).toBe(state.players[0].id);
      });
    });

    describe('player initialization', () => {
      it('should create correct number of players', () => {
        const state2 = createInitialState(['A', 'B']);
        expect(state2.players).toHaveLength(2);

        const state3 = createInitialState(['A', 'B', 'C']);
        expect(state3.players).toHaveLength(3);

        const state6 = createInitialState(['A', 'B', 'C', 'D', 'E', 'F']);
        expect(state6.players).toHaveLength(6);
      });

      it('should assign player names correctly', () => {
        const names = ['Alice', 'Bob'];
        const state = createInitialState(names);
        expect(state.players[0].name).toBe('Alice');
        expect(state.players[1].name).toBe('Bob');
      });

      it('should generate unique IDs for each player', () => {
        const state = createInitialState(['A', 'B', 'C', 'D']);
        const ids = state.players.map((p) => p.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it('should assign different colors to each player', () => {
        const state = createInitialState(['A', 'B', 'C', 'D']);
        const colors = state.players.map((p) => p.color);
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(colors.length);
      });

      it('should initialize all players as not eliminated', () => {
        const state = createInitialState(['A', 'B', 'C']);
        state.players.forEach((player) => {
          expect(player.isEliminated).toBe(false);
        });
      });
    });

    describe('configuration', () => {
      it('should use correct config for 2 players', () => {
        const state = createInitialState(['A', 'B']);
        expect(state.config.playerCount).toBe(2);
        expect(state.config.boardRadius).toBe(3);
        expect(state.config.warriorCount).toBe(5);
        expect(state.config.terrain).toBe('calm');
      });

      it('should use correct config for 3 players', () => {
        const state = createInitialState(['A', 'B', 'C']);
        expect(state.config.playerCount).toBe(3);
        expect(state.config.boardRadius).toBe(5);
        expect(state.config.warriorCount).toBe(5);
        expect(state.config.terrain).toBe('calm');
      });

      it('should apply turn timer when specified', () => {
        const state = createInitialState(['A', 'B'], 30000);
        expect(state.config.turnTimerMs).toBe(30000);
      });

      it('should have null turn timer by default', () => {
        const state = createInitialState(['A', 'B']);
        expect(state.config.turnTimerMs).toBeNull();
      });
    });

    describe('piece placement', () => {
      it('should create correct total number of pieces for 2 players (jarls + warriors only)', () => {
        const state = createInitialState(['A', 'B']);
        // 2 Jarls + 2 * 5 Warriors = 12 pieces (no shields anymore)
        expect(state.pieces).toHaveLength(12);
      });

      it('should create one Jarl per player', () => {
        const state = createInitialState(['A', 'B', 'C']);
        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        expect(jarls).toHaveLength(3);
      });

      it('should create correct number of warriors per player', () => {
        const state = createInitialState(['A', 'B']);
        state.players.forEach((player) => {
          const warriors = state.pieces.filter(
            (p) => p.type === 'warrior' && p.playerId === player.id
          );
          expect(warriors).toHaveLength(5);
        });
      });

      it('should place Jarls on edge hexes', () => {
        const state = createInitialState(['A', 'B']);
        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        jarls.forEach((jarl) => {
          expect(isOnEdgeAxial(jarl.position, state.config.boardRadius)).toBe(true);
        });
      });

      it('should assign correct playerId to Jarls and Warriors', () => {
        const state = createInitialState(['A', 'B']);
        const playerIds = state.players.map((p) => p.id);
        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        const warriors = state.pieces.filter((p) => p.type === 'warrior');
        jarls.forEach((jarl) => expect(playerIds).toContain(jarl.playerId));
        warriors.forEach((warrior) => expect(playerIds).toContain(warrior.playerId));
      });

      it('should place pieces at unique positions with unique IDs', () => {
        const state = createInitialState(['A', 'B']);
        const positionKeys = state.pieces.map((p) => hexToKey(p.position));
        const ids = state.pieces.map((p) => p.id);
        expect(new Set(positionKeys).size).toBe(positionKeys.length);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('should place all pieces within board bounds', () => {
        const state = createInitialState(['A', 'B']);
        state.pieces.forEach((piece) => {
          expect(isOnBoardAxial(piece.position, state.config.boardRadius)).toBe(true);
        });
      });

      it('should not place any piece on the Throne except potentially during game', () => {
        const state = createInitialState(['A', 'B']);
        const throneKey = hexToKey({ q: 0, r: 0 });
        state.pieces.forEach((piece) => {
          expect(hexToKey(piece.position)).not.toBe(throneKey);
        });
      });
    });

    describe('hole generation', () => {
      it('should generate holes array for calm terrain (3 holes)', () => {
        const state = createInitialState(['A', 'B']);
        expect(state.holes).toBeDefined();
        expect(Array.isArray(state.holes)).toBe(true);
        // Calm terrain = 3 holes
        expect(state.holes.length).toBe(3);
      });

      it('should not place holes on the throne', () => {
        const state = createInitialState(['A', 'B']);
        const throneKey = hexToKey({ q: 0, r: 0 });
        state.holes.forEach((hole) => {
          expect(hexToKey(hole)).not.toBe(throneKey);
        });
      });

      it('should not place holes on edge hexes', () => {
        const state = createInitialState(['A', 'B']);
        state.holes.forEach((hole) => {
          expect(isOnEdgeAxial(hole, state.config.boardRadius)).toBe(false);
        });
      });

      it('should not place holes on piece positions', () => {
        const state = createInitialState(['A', 'B']);
        const piecePositions = new Set(state.pieces.map((p) => hexToKey(p.position)));
        state.holes.forEach((hole) => {
          expect(piecePositions.has(hexToKey(hole))).toBe(false);
        });
      });
    });

    describe('error handling', () => {
      it.each([
        [['Solo'], 'single player'],
        [[], 'empty array'],
        [['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'too many players'],
      ])('should throw error for invalid player count (%s)', (names) => {
        expect(() => createInitialState(names)).toThrow(/Invalid player count/);
      });
    });

    describe('game scenarios', () => {
      it('should create valid state for all supported player counts', () => {
        for (let count = 2; count <= 6; count++) {
          const names = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
          const state = createInitialState(names);
          expect(state.players).toHaveLength(count);
          expect(state.config.playerCount).toBe(count);
        }
      });

      it('should create consistent state structure across multiple calls', () => {
        const state1 = createInitialState(['A', 'B']);
        const state2 = createInitialState(['A', 'B']);

        // Same structure
        expect(Object.keys(state1)).toEqual(Object.keys(state2));

        // Same player count
        expect(state1.players.length).toBe(state2.players.length);

        // Same piece counts
        expect(state1.pieces.length).toBe(state2.pieces.length);
        expect(state1.pieces.filter((p) => p.type === 'jarl').length).toBe(
          state2.pieces.filter((p) => p.type === 'jarl').length
        );
        expect(state1.pieces.filter((p) => p.type === 'warrior').length).toBe(
          state2.pieces.filter((p) => p.type === 'warrior').length
        );
      });

      it('should ensure Warriors are positioned between their Jarl and the Throne', () => {
        const state = createInitialState(['A', 'B']);
        const throne: AxialCoord = { q: 0, r: 0 };

        state.players.forEach((player) => {
          const jarl = state.pieces.find((p) => p.type === 'jarl' && p.playerId === player.id);
          const warriors = state.pieces.filter(
            (p) => p.type === 'warrior' && p.playerId === player.id
          );

          if (jarl) {
            const jarlDistance = hexDistanceAxial(jarl.position, throne);

            // At least some warriors should be closer to throne than the Jarl
            const closerWarriors = warriors.filter(
              (w) => hexDistanceAxial(w.position, throne) < jarlDistance
            );
            expect(closerWarriors.length).toBeGreaterThan(0);
          }
        });
      });
    });
  });
});
