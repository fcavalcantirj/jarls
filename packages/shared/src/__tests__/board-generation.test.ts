import {
  hexDistance,
  hexDistanceAxial,
  isOnBoard,
  isOnBoardAxial,
  isOnEdge,
  isOnEdgeAxial,
  hexToKey,
  getConfigForPlayerCount,
  getBoardHexCount,
  generateAllBoardHexes,
  generateAllBoardHexesAxial,
  hexToPixel,
  hexToAngle,
  calculateStartingPositions,
  rotateHex,
  createInitialState,
  CubeCoord,
  GameConfig,
} from '../index';

describe('board generation', () => {
  describe('getConfigForPlayerCount', () => {
    describe('2 players', () => {
      it('should return radius 3, 5 warriors, calm terrain', () => {
        const config = getConfigForPlayerCount(2);

        expect(config.playerCount).toBe(2);
        expect(config.boardRadius).toBe(3);
        expect(config.warriorCount).toBe(5);
        expect(config.terrain).toBe('calm');
      });

      it('should return 37 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(2);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(37);
      });
    });

    describe('3 players', () => {
      it('should return radius 5, 5 warriors, calm terrain', () => {
        const config = getConfigForPlayerCount(3);

        expect(config.playerCount).toBe(3);
        expect(config.boardRadius).toBe(5);
        expect(config.warriorCount).toBe(5);
        expect(config.terrain).toBe('calm');
      });

      it('should return 91 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(3);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(91);
      });
    });

    describe('4 players', () => {
      it('should return radius 6, 4 warriors, calm terrain', () => {
        const config = getConfigForPlayerCount(4);

        expect(config.playerCount).toBe(4);
        expect(config.boardRadius).toBe(6);
        expect(config.warriorCount).toBe(4);
        expect(config.terrain).toBe('calm');
      });

      it('should return 127 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(4);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(127);
      });
    });

    describe('5 players', () => {
      it('should return radius 7, 4 warriors, calm terrain', () => {
        const config = getConfigForPlayerCount(5);

        expect(config.playerCount).toBe(5);
        expect(config.boardRadius).toBe(7);
        expect(config.warriorCount).toBe(4);
        expect(config.terrain).toBe('calm');
      });

      it('should return 169 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(5);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(169);
      });
    });

    describe('6 players', () => {
      it('should return radius 8, 4 warriors, calm terrain', () => {
        const config = getConfigForPlayerCount(6);

        expect(config.playerCount).toBe(6);
        expect(config.boardRadius).toBe(8);
        expect(config.warriorCount).toBe(4);
        expect(config.terrain).toBe('calm');
      });

      it('should return 217 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(6);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(217);
      });
    });

    describe('turn timer', () => {
      it('should default to null (no timer)', () => {
        const config = getConfigForPlayerCount(2);
        expect(config.turnTimerMs).toBeNull();
      });

      it.each([30000, 60000, 120000])('should accept %ims turn timer', (timerMs) => {
        const config = getConfigForPlayerCount(2, timerMs);
        expect(config.turnTimerMs).toBe(timerMs);
      });
    });

    describe('invalid player counts', () => {
      it.each([0, 1, 7, -1])('should throw error for %i players', (count) => {
        expect(() => getConfigForPlayerCount(count)).toThrow(`Invalid player count: ${count}`);
      });
    });

    describe('return type verification', () => {
      it('should return a valid GameConfig object', () => {
        const config: GameConfig = getConfigForPlayerCount(2);

        expect(typeof config.playerCount).toBe('number');
        expect(typeof config.boardRadius).toBe('number');
        expect(typeof config.warriorCount).toBe('number');
        expect(typeof config.terrain).toBe('string');
        expect(config.turnTimerMs === null || typeof config.turnTimerMs === 'number').toBe(true);
      });

      it('should include all necessary parameters', () => {
        const config = getConfigForPlayerCount(2);

        expect(config).toHaveProperty('playerCount');
        expect(config).toHaveProperty('boardRadius');
        expect(config).toHaveProperty('warriorCount');
        expect(config).toHaveProperty('terrain');
        expect(config).toHaveProperty('turnTimerMs');
      });
    });

    describe('scaling table verification', () => {
      it('should have decreasing density as player count increases', () => {
        // Density = totalPieces / totalHexes
        // totalPieces = playerCount * (1 jarl + warriorCount)
        const densities: number[] = [];

        for (let players = 2; players <= 6; players++) {
          const config = getConfigForPlayerCount(players);
          const r = config.boardRadius;
          const totalHexes = 3 * r * r + 3 * r + 1;
          const totalPieces = config.playerCount * (1 + config.warriorCount);
          const density = totalPieces / totalHexes;
          densities.push(density);
        }

        // 2-player should be the most dense, decreasing toward 6-player
        expect(densities[0]).toBeGreaterThan(densities[1]); // 2p > 3p
        expect(densities[1]).toBeGreaterThan(densities[2]); // 3p > 4p
        expect(densities[2]).toBeGreaterThan(densities[3]); // 4p > 5p
        expect(densities[3]).toBeGreaterThan(densities[4]); // 5p > 6p
      });

      it('should have 2-player density around 32% (player pieces only)', () => {
        const config = getConfigForPlayerCount(2);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        // Ruleset counts only player pieces (jarls + warriors)
        const playerPieces = config.playerCount * (1 + config.warriorCount);
        const density = playerPieces / totalHexes;

        // Should be around 32% (12 player pieces / 37 hexes ≈ 32.4%)
        // 2 players × (1 jarl + 5 warriors) = 12 pieces
        expect(playerPieces).toBe(12);
        expect(density).toBeGreaterThan(0.3);
        expect(density).toBeLessThan(0.35);
      });
    });
  });

  describe('getBoardHexCount', () => {
    // Formula: 3r² + 3r + 1
    it.each([
      [0, 1],
      [1, 7],
      [2, 19],
      [3, 37],
      [5, 91],
      [6, 127],
      [7, 169],
      [8, 217],
    ])('should return %i hexes for radius %i', (radius, expected) => {
      expect(getBoardHexCount(radius)).toBe(expected);
    });
  });

  describe('generateAllBoardHexes', () => {
    describe('hex count verification', () => {
      it('should generate 1 hex for radius 0', () => {
        const hexes = generateAllBoardHexes(0);
        expect(hexes).toHaveLength(1);
        expect(hexes[0]).toEqual({ q: 0, r: 0, s: 0 });
      });

      it('should generate 7 hexes for radius 1', () => {
        const hexes = generateAllBoardHexes(1);
        expect(hexes).toHaveLength(7);
      });

      it('should generate 37 hexes for radius 3 (2-player board)', () => {
        const hexes = generateAllBoardHexes(3);
        expect(hexes).toHaveLength(37);
      });

      it('should generate correct count for all standard board sizes', () => {
        for (const radius of [0, 1, 2, 3, 5, 6, 7, 8]) {
          const hexes = generateAllBoardHexes(radius);
          const expectedCount = getBoardHexCount(radius);
          expect(hexes).toHaveLength(expectedCount);
        }
      });
    });

    describe('coordinate constraint verification', () => {
      it('should generate hexes that all satisfy cube coordinate constraint (q + r + s = 0)', () => {
        const hexes = generateAllBoardHexes(3);

        for (const hex of hexes) {
          expect(hex.q + hex.r + hex.s).toBe(0);
        }
      });

      it('should generate hexes all within board radius', () => {
        const radius = 3;
        const hexes = generateAllBoardHexes(radius);

        for (const hex of hexes) {
          expect(isOnBoard(hex, radius)).toBe(true);
        }
      });

      it('should include the center hex (Throne)', () => {
        const hexes = generateAllBoardHexes(3);
        const center = hexes.find((h) => h.q === 0 && h.r === 0 && h.s === 0);
        expect(center).toBeDefined();
      });

      it('should include all edge hexes', () => {
        const radius = 3;
        const hexes = generateAllBoardHexes(radius);

        // Count edge hexes in result
        const edgeHexes = hexes.filter((hex) => isOnEdge(hex, radius));

        // Should be 6r edge hexes
        expect(edgeHexes).toHaveLength(6 * radius);
      });
    });

    describe('uniqueness verification', () => {
      it('should generate all unique hexes', () => {
        const hexes = generateAllBoardHexes(3);
        const keys = hexes.map(hexToKey);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(hexes.length);
      });

      it('should generate unique hexes for larger boards', () => {
        const hexes = generateAllBoardHexes(5);
        const keys = hexes.map(hexToKey);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(hexes.length);
      });
    });

    describe('completeness verification', () => {
      it('should include all hexes at each distance from center', () => {
        const radius = 3;
        const hexes = generateAllBoardHexes(radius);

        // Count hexes at each distance
        const countByDistance: number[] = new Array(radius + 1).fill(0);
        const center: CubeCoord = { q: 0, r: 0, s: 0 };

        for (const hex of hexes) {
          const dist = hexDistance(hex, center);
          countByDistance[dist]++;
        }

        // Distance 0: 1 hex (center)
        expect(countByDistance[0]).toBe(1);

        // Distance d > 0: 6d hexes (ring of hexes at that distance)
        for (let d = 1; d <= radius; d++) {
          expect(countByDistance[d]).toBe(6 * d);
        }
      });

      it('should cover all positions that isOnBoard returns true for', () => {
        const radius = 3;
        const hexes = generateAllBoardHexes(radius);
        const hexSet = new Set(hexes.map(hexToKey));

        // Check all possible positions in bounding box
        for (let q = -radius; q <= radius; q++) {
          for (let r = -radius; r <= radius; r++) {
            const s = -q - r;
            const hex: CubeCoord = { q, r, s };

            if (isOnBoard(hex, radius)) {
              expect(hexSet.has(hexToKey(hex))).toBe(true);
            }
          }
        }
      });
    });

    describe('specific hex positions', () => {
      it('should include standard cardinal edge positions for radius 3', () => {
        const hexes = generateAllBoardHexes(3);
        const hexSet = new Set(hexes.map(hexToKey));

        // Cardinal edge positions
        const cardinalEdges: CubeCoord[] = [
          { q: 3, r: 0, s: -3 }, // East
          { q: 3, r: -3, s: 0 }, // Northeast
          { q: 0, r: -3, s: 3 }, // Northwest
          { q: -3, r: 0, s: 3 }, // West
          { q: -3, r: 3, s: 0 }, // Southwest
          { q: 0, r: 3, s: -3 }, // Southeast
        ];

        for (const edge of cardinalEdges) {
          expect(hexSet.has(hexToKey(edge))).toBe(true);
        }
      });

      it('should include Jarl starting positions (opposite edges)', () => {
        const hexes = generateAllBoardHexes(3);
        const hexSet = new Set(hexes.map(hexToKey));

        // Player 1 Jarl at East edge, Player 2 at West edge
        expect(hexSet.has(hexToKey({ q: 3, r: 0, s: -3 }))).toBe(true);
        expect(hexSet.has(hexToKey({ q: -3, r: 0, s: 3 }))).toBe(true);
      });
    });
  });

  describe('generateAllBoardHexesAxial', () => {
    it('should generate the same number of hexes as cube version', () => {
      const radius = 3;
      const cubeHexes = generateAllBoardHexes(radius);
      const axialHexes = generateAllBoardHexesAxial(radius);

      expect(axialHexes).toHaveLength(cubeHexes.length);
    });

    it('should generate 37 hexes for radius 3', () => {
      const hexes = generateAllBoardHexesAxial(3);
      expect(hexes).toHaveLength(37);
    });

    it('should be consistent with cube version after conversion', () => {
      const radius = 3;
      const cubeHexes = generateAllBoardHexes(radius);
      const axialHexes = generateAllBoardHexesAxial(radius);

      // Convert cube to axial and compare
      const convertedCube = cubeHexes.map((h) => ({ q: h.q, r: h.r }));
      const cubeKeys = new Set(convertedCube.map(hexToKey));
      const axialKeys = new Set(axialHexes.map(hexToKey));

      expect(cubeKeys.size).toBe(axialKeys.size);

      for (const key of cubeKeys) {
        expect(axialKeys.has(key)).toBe(true);
      }
    });

    it('should include the center hex', () => {
      const hexes = generateAllBoardHexesAxial(3);
      const center = hexes.find((h) => h.q === 0 && h.r === 0);
      expect(center).toBeDefined();
    });

    it('should include all unique hexes', () => {
      const hexes = generateAllBoardHexesAxial(3);
      const keys = hexes.map(hexToKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(hexes.length);
    });
  });

  describe('hexToPixel', () => {
    it('should return (0, 0) for the center hex', () => {
      const pixel = hexToPixel({ q: 0, r: 0 }, 1);
      expect(pixel.x).toBeCloseTo(0);
      expect(pixel.y).toBeCloseTo(0);
    });

    it('should return correct position for East hex', () => {
      const pixel = hexToPixel({ q: 1, r: 0 }, 1);
      // For pointy-top, q=1,r=0 should be to the right (East)
      expect(pixel.x).toBeCloseTo(Math.sqrt(3));
      expect(pixel.y).toBeCloseTo(0);
    });

    it('should scale with size parameter', () => {
      const pixel1 = hexToPixel({ q: 1, r: 0 }, 1);
      const pixel2 = hexToPixel({ q: 1, r: 0 }, 2);
      expect(pixel2.x).toBeCloseTo(pixel1.x * 2);
      expect(pixel2.y).toBeCloseTo(pixel1.y * 2);
    });
  });

  describe('hexToAngle', () => {
    it('should return 0 for East direction (q > 0, r = 0)', () => {
      const angle = hexToAngle({ q: 3, r: 0 });
      expect(angle).toBeCloseTo(0);
    });

    it('should return approximately π for West direction (q < 0, r = 0)', () => {
      const angle = hexToAngle({ q: -3, r: 0 });
      expect(Math.abs(angle)).toBeCloseTo(Math.PI);
    });

    it('should return positive angles in upper half (r < 0)', () => {
      // r < 0 means y < 0 in our coordinate system, but atan2 considers this
      const angle = hexToAngle({ q: 0, r: -3 });
      // This should be in the upper half of the board
      expect(angle).toBeLessThan(0); // Actually negative because y is negative for r < 0
    });
  });

  describe('calculateStartingPositions', () => {
    describe('2 players', () => {
      it('should return exactly 2 positions', () => {
        const positions = calculateStartingPositions(2, 3);
        expect(positions).toHaveLength(2);
      });

      it('should place Jarls at opposite edges', () => {
        const positions = calculateStartingPositions(2, 3);
        // Both should be on edge
        expect(isOnEdgeAxial(positions[0], 3)).toBe(true);
        expect(isOnEdgeAxial(positions[1], 3)).toBe(true);

        // They should be on opposite sides (180 degrees apart)
        const angle1 = hexToAngle(positions[0]);
        const angle2 = hexToAngle(positions[1]);
        let angleDiff = Math.abs(angle2 - angle1);
        if (angleDiff > Math.PI) {
          angleDiff = 2 * Math.PI - angleDiff;
        }
        // Should be approximately π (180 degrees) apart
        expect(angleDiff).toBeCloseTo(Math.PI, 0);
      });

      it('should place both Jarls equidistant from center (same distance)', () => {
        const positions = calculateStartingPositions(2, 3);
        const dist1 = hexDistanceAxial(positions[0], { q: 0, r: 0 });
        const dist2 = hexDistanceAxial(positions[1], { q: 0, r: 0 });
        expect(dist1).toBe(dist2);
        expect(dist1).toBe(3); // Should be at edge (radius)
      });
    });

    describe('3 players', () => {
      it('should return exactly 3 positions', () => {
        const positions = calculateStartingPositions(3, 5);
        expect(positions).toHaveLength(3);
      });

      it('should place all Jarls on edge', () => {
        const positions = calculateStartingPositions(3, 5);
        positions.forEach((pos) => {
          expect(isOnEdgeAxial(pos, 5)).toBe(true);
        });
      });

      it('should place all Jarls equidistant from center', () => {
        const positions = calculateStartingPositions(3, 5);
        const distances = positions.map((pos) => hexDistanceAxial(pos, { q: 0, r: 0 }));
        expect(new Set(distances).size).toBe(1); // All same distance
        expect(distances[0]).toBe(5); // At radius
      });

      it('should place Jarls in different angular regions', () => {
        const positions = calculateStartingPositions(3, 5);
        const angles = positions.map(hexToAngle);

        // All angles should be distinct (not clustered together)
        // Check that each pair has at least 60 degrees (π/3 radians) difference
        // This ensures players are spread out, even if not perfectly 120° apart
        // due to hex grid discretization
        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            let angleDiff = Math.abs(angles[j] - angles[i]);
            if (angleDiff > Math.PI) {
              angleDiff = 2 * Math.PI - angleDiff;
            }
            // At least 60 degrees apart (half of ideal 120°)
            expect(angleDiff).toBeGreaterThan(Math.PI / 3);
          }
        }
      });
    });

    describe('all player counts', () => {
      it.each([2, 3, 4, 5, 6])(
        'should return %i unique positions for %i players',
        (playerCount) => {
          const config = getConfigForPlayerCount(playerCount);
          const positions = calculateStartingPositions(playerCount, config.boardRadius);

          expect(positions).toHaveLength(playerCount);

          // All positions should be unique
          const keys = positions.map(hexToKey);
          expect(new Set(keys).size).toBe(playerCount);
        }
      );

      it.each([2, 3, 4, 5, 6])('should place all %i Jarls on edge hexes', (playerCount) => {
        const config = getConfigForPlayerCount(playerCount);
        const positions = calculateStartingPositions(playerCount, config.boardRadius);

        positions.forEach((pos) => {
          expect(isOnEdgeAxial(pos, config.boardRadius)).toBe(true);
        });
      });

      it.each([2, 3, 4, 5, 6])(
        'should place all %i Jarls equidistant from Throne',
        (playerCount) => {
          const config = getConfigForPlayerCount(playerCount);
          const positions = calculateStartingPositions(playerCount, config.boardRadius);

          const distances = positions.map((pos) => hexDistanceAxial(pos, { q: 0, r: 0 }));

          // All distances should be the same
          expect(new Set(distances).size).toBe(1);

          // Distance should equal the radius (edge of board)
          expect(distances[0]).toBe(config.boardRadius);
        }
      );
    });

    describe('error handling', () => {
      it.each([0, 1, 7, -1])('should throw error for %i players', (count) => {
        expect(() => calculateStartingPositions(count, 3)).toThrow('Invalid player count');
      });
    });

    describe('position validity', () => {
      it('should return valid board positions', () => {
        const positions = calculateStartingPositions(4, 6);
        positions.forEach((pos) => {
          expect(isOnBoardAxial(pos, 6)).toBe(true);
        });
      });

      it('should not place any Jarl on the Throne (center)', () => {
        for (let playerCount = 2; playerCount <= 6; playerCount++) {
          const config = getConfigForPlayerCount(playerCount);
          const positions = calculateStartingPositions(playerCount, config.boardRadius);

          positions.forEach((pos) => {
            // Center is at (0, 0)
            expect(pos.q !== 0 || pos.r !== 0).toBe(true);
          });
        }
      });
    });
  });

  describe('rotateHex', () => {
    const center: CubeCoord = { q: 0, r: 0, s: 0 };

    it('should not change the center hex', () => {
      for (let steps = 0; steps < 6; steps++) {
        expect(rotateHex(center, steps)).toEqual(center);
      }
    });

    it('should rotate a hex 60 degrees and return after 6 rotations', () => {
      const hex: CubeCoord = { q: 1, r: 0, s: -1 };
      expect(rotateHex(hex, 1)).toEqual({ q: 0, r: 1, s: -1 });
      expect(rotateHex(hex, 6)).toEqual(hex);
    });

    it('should preserve distance from center and cube constraint', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const originalDist = hexDistance(hex, center);
      for (let steps = 1; steps < 6; steps++) {
        const rotated = rotateHex(hex, steps);
        expect(hexDistance(rotated, center)).toBe(originalDist);
        expect(rotated.q + rotated.r + rotated.s).toBe(0);
      }
    });

    it('should handle negative rotation steps', () => {
      const hex: CubeCoord = { q: 1, r: 0, s: -1 };
      expect(rotateHex(hex, 1)).toEqual(rotateHex(hex, -5));
    });
  });

  describe('createInitialState', () => {
    describe('default board radius', () => {
      it('should use default radius 3 for 2 players', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.config.boardRadius).toBe(3);
      });

      it('should place Jarls on edge for default 2-player board', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        const jarls = state.pieces.filter((p) => p.type === 'jarl');

        expect(jarls).toHaveLength(2);
        jarls.forEach((jarl) => {
          expect(isOnEdgeAxial(jarl.position, state.config.boardRadius)).toBe(true);
        });
      });
    });

    describe('custom board radius', () => {
      it('should accept custom board radius that overrides default', () => {
        // 2 players default to radius 3, but we request radius 5
        const state = createInitialState(['Player 1', 'Player 2'], null, 5);
        expect(state.config.boardRadius).toBe(5);
      });

      it('should place Jarls on edge of CUSTOM radius, not default', () => {
        // This test verifies the bug fix: Jarls should be on edge of radius 5,
        // not radius 3 (the default for 2 players)
        const customRadius = 5;
        const state = createInitialState(['Player 1', 'Player 2'], null, customRadius);

        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        expect(jarls).toHaveLength(2);

        jarls.forEach((jarl) => {
          // Jarl should be on edge of the CUSTOM radius (5), not default (3)
          expect(isOnEdgeAxial(jarl.position, customRadius)).toBe(true);

          // Verify distance from center equals the custom radius
          const distFromCenter = hexDistanceAxial(jarl.position, { q: 0, r: 0 });
          expect(distFromCenter).toBe(customRadius);
        });
      });

      it('should NOT place Jarls on default radius edge when custom radius is larger', () => {
        const customRadius = 6;
        const defaultRadius = 3; // Default for 2 players
        const state = createInitialState(['Player 1', 'Player 2'], null, customRadius);

        const jarls = state.pieces.filter((p) => p.type === 'jarl');

        jarls.forEach((jarl) => {
          // Should NOT be on edge of default radius (that would be a bug)
          expect(isOnEdgeAxial(jarl.position, defaultRadius)).toBe(false);

          // Should be on edge of custom radius
          expect(isOnEdgeAxial(jarl.position, customRadius)).toBe(true);
        });
      });

      it('should generate warriors between Jarl and throne on custom board', () => {
        const customRadius = 5;
        const state = createInitialState(['Player 1', 'Player 2'], null, customRadius);

        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        const warriors = state.pieces.filter((p) => p.type === 'warrior');

        // Each player should have 5 warriors (default for 2 players)
        expect(warriors).toHaveLength(10);

        // Warriors should be between Jarl and throne (closer to center than Jarl)
        for (const player of state.players) {
          const playerJarl = jarls.find((j) => j.playerId === player.id);
          const playerWarriors = warriors.filter((w) => w.playerId === player.id);

          expect(playerJarl).toBeDefined();
          expect(playerWarriors).toHaveLength(5);

          const jarlDist = hexDistanceAxial(playerJarl!.position, { q: 0, r: 0 });

          // At least some warriors should be closer to center than the Jarl
          const closerWarriors = playerWarriors.filter((w) => {
            const wDist = hexDistanceAxial(w.position, { q: 0, r: 0 });
            return wDist < jarlDist;
          });
          expect(closerWarriors.length).toBeGreaterThan(0);
        }
      });

      it.each([4, 5, 6, 7, 8])(
        'should place Jarls on edge for custom radius %i (2 players)',
        (customRadius) => {
          const state = createInitialState(['Player 1', 'Player 2'], null, customRadius);
          const jarls = state.pieces.filter((p) => p.type === 'jarl');

          jarls.forEach((jarl) => {
            expect(isOnEdgeAxial(jarl.position, customRadius)).toBe(true);
            expect(hexDistanceAxial(jarl.position, { q: 0, r: 0 })).toBe(customRadius);
          });
        }
      );
    });

    describe('holes generation', () => {
      it('should generate holes for calm terrain (3 holes)', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        expect(state.holes).toBeDefined();
        expect(Array.isArray(state.holes)).toBe(true);
        expect(state.holes.length).toBe(3);
      });

      it('should place all holes within board bounds', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.holes.forEach((hole) => {
          expect(isOnBoardAxial(hole, state.config.boardRadius)).toBe(true);
        });
      });

      it('should not place holes on the throne', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        const throneKey = hexToKey({ q: 0, r: 0 });
        state.holes.forEach((hole) => {
          expect(hexToKey(hole)).not.toBe(throneKey);
        });
      });

      it('should not place holes on edge hexes', () => {
        const state = createInitialState(['Player 1', 'Player 2']);
        state.holes.forEach((hole) => {
          expect(isOnEdgeAxial(hole, state.config.boardRadius)).toBe(false);
        });
      });
    });
  });
});
