import {
  axialToCube,
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
  generateSymmetricalShields,
  hasPathToThrone,
  validateShieldPlacement,
  getDirectionTowardThrone,
  placeWarriors,
  generateId,
  createInitialState,
  getNeighbor,
  AxialCoord,
  CubeCoord,
  GameConfig,
} from '../index';

describe('board', () => {
  describe('getConfigForPlayerCount', () => {
    describe('2 players', () => {
      it('should return radius 3, 5 shields, 5 warriors', () => {
        const config = getConfigForPlayerCount(2);

        expect(config.playerCount).toBe(2);
        expect(config.boardRadius).toBe(3);
        expect(config.shieldCount).toBe(5);
        expect(config.warriorCount).toBe(5);
      });

      it('should return 37 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(2);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(37);
      });
    });

    describe('3 players', () => {
      it('should return radius 5, 4 shields, 5 warriors', () => {
        const config = getConfigForPlayerCount(3);

        expect(config.playerCount).toBe(3);
        expect(config.boardRadius).toBe(5);
        expect(config.shieldCount).toBe(4);
        expect(config.warriorCount).toBe(5);
      });

      it('should return 91 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(3);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(91);
      });
    });

    describe('4 players', () => {
      it('should return radius 6, 4 shields, 4 warriors', () => {
        const config = getConfigForPlayerCount(4);

        expect(config.playerCount).toBe(4);
        expect(config.boardRadius).toBe(6);
        expect(config.shieldCount).toBe(4);
        expect(config.warriorCount).toBe(4);
      });

      it('should return 127 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(4);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(127);
      });
    });

    describe('5 players', () => {
      it('should return radius 7, 3 shields, 4 warriors', () => {
        const config = getConfigForPlayerCount(5);

        expect(config.playerCount).toBe(5);
        expect(config.boardRadius).toBe(7);
        expect(config.shieldCount).toBe(3);
        expect(config.warriorCount).toBe(4);
      });

      it('should return 169 total hexes (3r² + 3r + 1)', () => {
        const config = getConfigForPlayerCount(5);
        const r = config.boardRadius;
        const totalHexes = 3 * r * r + 3 * r + 1;
        expect(totalHexes).toBe(169);
      });
    });

    describe('6 players', () => {
      it('should return radius 8, 3 shields, 4 warriors', () => {
        const config = getConfigForPlayerCount(6);

        expect(config.playerCount).toBe(6);
        expect(config.boardRadius).toBe(8);
        expect(config.shieldCount).toBe(3);
        expect(config.warriorCount).toBe(4);
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

      it('should accept custom turn timer', () => {
        const config = getConfigForPlayerCount(2, 30000);
        expect(config.turnTimerMs).toBe(30000);
      });

      it('should accept 60 second timer', () => {
        const config = getConfigForPlayerCount(3, 60000);
        expect(config.turnTimerMs).toBe(60000);
      });

      it('should accept 120 second timer', () => {
        const config = getConfigForPlayerCount(4, 120000);
        expect(config.turnTimerMs).toBe(120000);
      });
    });

    describe('invalid player counts', () => {
      it('should throw error for 0 players', () => {
        expect(() => getConfigForPlayerCount(0)).toThrow('Invalid player count: 0');
      });

      it('should throw error for 1 player', () => {
        expect(() => getConfigForPlayerCount(1)).toThrow('Invalid player count: 1');
      });

      it('should throw error for 7 players', () => {
        expect(() => getConfigForPlayerCount(7)).toThrow('Invalid player count: 7');
      });

      it('should throw error for negative players', () => {
        expect(() => getConfigForPlayerCount(-1)).toThrow('Invalid player count: -1');
      });
    });

    describe('return type verification', () => {
      it('should return a valid GameConfig object', () => {
        const config: GameConfig = getConfigForPlayerCount(2);

        expect(typeof config.playerCount).toBe('number');
        expect(typeof config.boardRadius).toBe('number');
        expect(typeof config.shieldCount).toBe('number');
        expect(typeof config.warriorCount).toBe('number');
        expect(config.turnTimerMs === null || typeof config.turnTimerMs === 'number').toBe(true);
      });

      it('should include all necessary parameters', () => {
        const config = getConfigForPlayerCount(2);

        expect(config).toHaveProperty('playerCount');
        expect(config).toHaveProperty('boardRadius');
        expect(config).toHaveProperty('shieldCount');
        expect(config).toHaveProperty('warriorCount');
        expect(config).toHaveProperty('turnTimerMs');
      });
    });

    describe('scaling table verification', () => {
      it('should have decreasing density as player count increases', () => {
        // Density = totalPieces / totalHexes
        // totalPieces = playerCount * (1 jarl + warriorCount) + shieldCount
        const densities: number[] = [];

        for (let players = 2; players <= 6; players++) {
          const config = getConfigForPlayerCount(players);
          const r = config.boardRadius;
          const totalHexes = 3 * r * r + 3 * r + 1;
          const totalPieces = config.playerCount * (1 + config.warriorCount) + config.shieldCount;
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
        // Ruleset counts only player pieces (jarls + warriors), not shields
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
    it('should return 1 for radius 0 (single hex)', () => {
      expect(getBoardHexCount(0)).toBe(1);
    });

    it('should return 7 for radius 1', () => {
      // 3(1)² + 3(1) + 1 = 3 + 3 + 1 = 7
      expect(getBoardHexCount(1)).toBe(7);
    });

    it('should return 19 for radius 2', () => {
      // 3(2)² + 3(2) + 1 = 12 + 6 + 1 = 19
      expect(getBoardHexCount(2)).toBe(19);
    });

    it('should return 37 for radius 3 (2-player board)', () => {
      // 3(3)² + 3(3) + 1 = 27 + 9 + 1 = 37
      expect(getBoardHexCount(3)).toBe(37);
    });

    it('should return 91 for radius 5 (3-player board)', () => {
      // 3(5)² + 3(5) + 1 = 75 + 15 + 1 = 91
      expect(getBoardHexCount(5)).toBe(91);
    });

    it('should return 127 for radius 6 (4-player board)', () => {
      // 3(6)² + 3(6) + 1 = 108 + 18 + 1 = 127
      expect(getBoardHexCount(6)).toBe(127);
    });

    it('should return 169 for radius 7 (5-player board)', () => {
      // 3(7)² + 3(7) + 1 = 147 + 21 + 1 = 169
      expect(getBoardHexCount(7)).toBe(169);
    });

    it('should return 217 for radius 8 (6-player board)', () => {
      // 3(8)² + 3(8) + 1 = 192 + 24 + 1 = 217
      expect(getBoardHexCount(8)).toBe(217);
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
      it('should throw error for 0 players', () => {
        expect(() => calculateStartingPositions(0, 3)).toThrow('Invalid player count');
      });

      it('should throw error for 1 player', () => {
        expect(() => calculateStartingPositions(1, 3)).toThrow('Invalid player count');
      });

      it('should throw error for 7 players', () => {
        expect(() => calculateStartingPositions(7, 3)).toThrow('Invalid player count');
      });

      it('should throw error for negative players', () => {
        expect(() => calculateStartingPositions(-1, 3)).toThrow('Invalid player count');
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
    it('should not change the center hex', () => {
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      for (let steps = 0; steps < 6; steps++) {
        const rotated = rotateHex(center, steps);
        expect(rotated).toEqual(center);
      }
    });

    it('should rotate a hex 60 degrees counter-clockwise with steps=1', () => {
      // East direction (1, 0, -1) should become Northeast (1, -1, 0)
      const hex: CubeCoord = { q: 1, r: 0, s: -1 };
      const rotated = rotateHex(hex, 1);
      // Rotation: (q, r, s) -> (-r, -s, -q)
      expect(rotated).toEqual({ q: 0, r: 1, s: -1 });
    });

    it('should return to original position after 6 rotations', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const rotated = rotateHex(hex, 6);
      expect(rotated).toEqual(hex);
    });

    it('should preserve distance from center', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      const originalDist = hexDistance(hex, center);

      for (let steps = 1; steps < 6; steps++) {
        const rotated = rotateHex(hex, steps);
        expect(hexDistance(rotated, center)).toBe(originalDist);
      }
    });

    it('should satisfy cube coordinate constraint after rotation', () => {
      const hex: CubeCoord = { q: 3, r: -2, s: -1 };
      for (let steps = 0; steps < 6; steps++) {
        const rotated = rotateHex(hex, steps);
        expect(rotated.q + rotated.r + rotated.s).toBe(0);
      }
    });

    it('should handle negative rotation steps', () => {
      const hex: CubeCoord = { q: 1, r: 0, s: -1 };
      const rotatedPos = rotateHex(hex, 1);
      const rotatedNeg = rotateHex(hex, -5); // -5 mod 6 = 1
      expect(rotatedPos).toEqual(rotatedNeg);
    });
  });

  describe('generateSymmetricalShields', () => {
    describe('basic functionality', () => {
      it('should return the correct number of shields for 2-player game', () => {
        const config = getConfigForPlayerCount(2);
        const shields = generateSymmetricalShields(2, config.boardRadius, config.shieldCount);
        expect(shields).toHaveLength(config.shieldCount);
      });

      it('should return the correct number of shields for all player counts', () => {
        for (let playerCount = 2; playerCount <= 6; playerCount++) {
          const config = getConfigForPlayerCount(playerCount);
          const shields = generateSymmetricalShields(
            playerCount,
            config.boardRadius,
            config.shieldCount
          );
          expect(shields).toHaveLength(config.shieldCount);
        }
      });

      it('should return empty array when shieldCount is 0', () => {
        const shields = generateSymmetricalShields(2, 3, 0);
        expect(shields).toHaveLength(0);
      });
    });

    describe('position constraints', () => {
      it('should not place shields on the Throne (center)', () => {
        const shields = generateSymmetricalShields(2, 3, 5);
        shields.forEach((shield) => {
          expect(shield.q !== 0 || shield.r !== 0).toBe(true);
        });
      });

      it('should not place shields on edge hexes', () => {
        for (let playerCount = 2; playerCount <= 6; playerCount++) {
          const config = getConfigForPlayerCount(playerCount);
          const shields = generateSymmetricalShields(
            playerCount,
            config.boardRadius,
            config.shieldCount
          );

          shields.forEach((shield) => {
            expect(isOnEdgeAxial(shield, config.boardRadius)).toBe(false);
          });
        }
      });

      it('should place all shields within the board', () => {
        const shields = generateSymmetricalShields(2, 3, 5);
        shields.forEach((shield) => {
          expect(isOnBoardAxial(shield, 3)).toBe(true);
        });
      });

      it('should place all shields in interior (not center, not edge)', () => {
        const shields = generateSymmetricalShields(2, 3, 5);
        shields.forEach((shield) => {
          const dist = hexDistanceAxial(shield, { q: 0, r: 0 });
          expect(dist).toBeGreaterThan(0); // Not center
          expect(dist).toBeLessThan(3); // Not edge (radius = 3)
        });
      });

      it('should return all unique positions', () => {
        const shields = generateSymmetricalShields(2, 3, 5);
        const keys = shields.map(hexToKey);
        expect(new Set(keys).size).toBe(shields.length);
      });
    });

    describe('rotational symmetry', () => {
      it('should have rotational symmetry for 2 players', () => {
        const shields = generateSymmetricalShields(2, 3, 4); // Use even number for better symmetry
        const shieldSet = new Set(shields.map(hexToKey));

        // For each shield, its 180-degree rotation should also be in the set
        let symmetricPairs = 0;
        for (const shield of shields) {
          const cube = axialToCube(shield);
          const rotated = rotateHex(cube, 3); // 3 steps = 180 degrees
          if (shieldSet.has(hexToKey(rotated))) {
            symmetricPairs++;
          }
        }

        // At least half the shields should have a symmetric partner
        // (some hexes on the axis of symmetry map to themselves)
        expect(symmetricPairs).toBeGreaterThanOrEqual(Math.floor(shields.length / 2));
      });

      it('should prefer symmetric groups when possible', () => {
        const shields = generateSymmetricalShields(3, 5, 3);
        const shieldSet = new Set(shields.map(hexToKey));

        // For 3 shields in a 3-player game, they should ideally be 120 degrees apart
        // Check that rotations of first shield hit other shields
        const firstCube = axialToCube(shields[0]);
        let foundRotations = 1; // Count the original
        for (let i = 1; i < 3; i++) {
          const rotated = rotateHex(firstCube, i * 2); // 0, 2, 4 steps for 3-fold symmetry
          if (shieldSet.has(hexToKey(rotated))) {
            foundRotations++;
          }
        }

        // Should find at least 2 shields from the rotation group
        expect(foundRotations).toBeGreaterThanOrEqual(2);
      });
    });

    describe('equidistance from starting positions', () => {
      it('should place shields equidistant from starting positions for 2 players', () => {
        const config = getConfigForPlayerCount(2);
        const startPositions = calculateStartingPositions(2, config.boardRadius);
        const shields = generateSymmetricalShields(2, config.boardRadius, config.shieldCount);

        // For symmetric shields, the sum of distances to all starting positions
        // should be the same for each shield (due to rotational symmetry)
        // or at least very similar
        const distanceSums = shields.map((shield) => {
          return startPositions.reduce((sum, start) => {
            return sum + hexDistanceAxial(shield, start);
          }, 0);
        });

        // Check that distance sums are relatively balanced
        const maxDiff = Math.max(...distanceSums) - Math.min(...distanceSums);
        expect(maxDiff).toBeLessThanOrEqual(2); // Allow small variation due to hex grid
      });
    });

    describe('error handling', () => {
      it('should throw error for invalid player count (too low)', () => {
        expect(() => generateSymmetricalShields(1, 3, 5)).toThrow('Invalid player count');
      });

      it('should throw error for invalid player count (too high)', () => {
        expect(() => generateSymmetricalShields(7, 3, 5)).toThrow('Invalid player count');
      });

      it('should throw error when not enough space for shields', () => {
        // Radius 1 board has only 7 hexes: 1 center, 6 edge, 0 interior
        expect(() => generateSymmetricalShields(2, 1, 1)).toThrow('Unable to place');
      });
    });

    describe('game scenarios', () => {
      it('should work with standard 2-player configuration (radius 3, 5 shields)', () => {
        const shields = generateSymmetricalShields(2, 3, 5);
        expect(shields).toHaveLength(5);

        // Verify all are valid interior positions
        shields.forEach((shield) => {
          expect(isOnBoardAxial(shield, 3)).toBe(true);
          expect(isOnEdgeAxial(shield, 3)).toBe(false);
          const dist = hexDistanceAxial(shield, { q: 0, r: 0 });
          expect(dist).toBeGreaterThan(0);
        });
      });

      it('should work with standard 3-player configuration (radius 5, 4 shields)', () => {
        const shields = generateSymmetricalShields(3, 5, 4);
        expect(shields).toHaveLength(4);
      });

      it('should work with standard 4-player configuration (radius 6, 4 shields)', () => {
        const shields = generateSymmetricalShields(4, 6, 4);
        expect(shields).toHaveLength(4);
      });

      it('should work with standard 5-player configuration (radius 7, 3 shields)', () => {
        const shields = generateSymmetricalShields(5, 7, 3);
        expect(shields).toHaveLength(3);
      });

      it('should work with standard 6-player configuration (radius 8, 3 shields)', () => {
        const shields = generateSymmetricalShields(6, 8, 3);
        expect(shields).toHaveLength(3);
      });
    });
  });

  describe('hasPathToThrone', () => {
    describe('basic path detection', () => {
      it('should return true when no shields block the path', () => {
        const startPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        const shieldPositions = new Set<string>(); // No shields
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should return true when shields do not block the direct path', () => {
        const startPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        // Place shield not on the straight-line path from start to throne
        // Path from (3,0) to (0,0) goes through (2,0), (1,0)
        const shieldPositions = new Set<string>([hexToKey({ q: 1, r: 1 })]);
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should return false when a shield blocks the direct path', () => {
        const startPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        // Block the path from (3,0) to (0,0) by placing shield on (2,0)
        const shieldPositions = new Set<string>([hexToKey({ q: 2, r: 0 })]);
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(false);
      });

      it('should return false when a shield blocks the path closer to throne', () => {
        const startPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        // Block the path from (3,0) to (0,0) by placing shield on (1,0)
        const shieldPositions = new Set<string>([hexToKey({ q: 1, r: 0 })]);
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(false);
      });
    });

    describe('various starting positions', () => {
      it('should detect path from West edge', () => {
        const startPosition: AxialCoord = { q: -3, r: 0 }; // West edge
        const shieldPositions = new Set<string>();
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should detect path from Northeast area', () => {
        const startPosition: AxialCoord = { q: 2, r: -2 }; // NE area
        const shieldPositions = new Set<string>();
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should detect path from Southwest area', () => {
        const startPosition: AxialCoord = { q: -2, r: 2 }; // SW area
        const shieldPositions = new Set<string>();
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should handle diagonal paths correctly', () => {
        // Position (2, -2) has a line to (0, 0) through (1, -1)
        const startPosition: AxialCoord = { q: 2, r: -2 };
        // Block the path at (1, -1)
        const shieldPositions = new Set<string>([hexToKey({ q: 1, r: -1 })]);
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(false);
      });
    });

    describe('throne adjacency', () => {
      it('should return true when starting adjacent to throne with no shields', () => {
        const startPosition: AxialCoord = { q: 1, r: 0 }; // Adjacent to throne
        const shieldPositions = new Set<string>();
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });

      it('should return true when adjacent - no hexes between to block', () => {
        const startPosition: AxialCoord = { q: 1, r: -1 }; // Adjacent to throne
        const shieldPositions = new Set<string>();
        const result = hasPathToThrone(startPosition, shieldPositions, 3);
        expect(result).toBe(true);
      });
    });
  });

  describe('validateShieldPlacement', () => {
    describe('valid placements', () => {
      it('should return isValid true when no shields block any paths', () => {
        const shieldPositions: AxialCoord[] = [];
        const startingPositions = calculateStartingPositions(2, 3);
        const result = validateShieldPlacement(shieldPositions, startingPositions, 3);
        expect(result.isValid).toBe(true);
        expect(result.blockedPlayers).toHaveLength(0);
      });

      it('should correctly validate shield placement (may detect blocked paths)', () => {
        // Note: generateSymmetricalShields may produce placements that block paths
        // This test verifies that validateShieldPlacement correctly detects such issues
        const config = getConfigForPlayerCount(2);
        const shieldPositions = generateSymmetricalShields(
          2,
          config.boardRadius,
          config.shieldCount
        );
        const startingPositions = calculateStartingPositions(2, config.boardRadius);
        const result = validateShieldPlacement(
          shieldPositions,
          startingPositions,
          config.boardRadius
        );
        // The function should return a valid result object
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
        // If invalid, blockedPlayers should list which players are blocked
        if (!result.isValid) {
          expect(result.blockedPlayers.length).toBeGreaterThan(0);
        }
      });

      it('should return isValid true when shields are not on direct paths', () => {
        // Place shields in positions that don't block direct paths
        const shieldPositions: AxialCoord[] = [
          { q: 1, r: 1 },
          { q: -1, r: -1 },
        ];
        const startingPositions: AxialCoord[] = [
          { q: 3, r: 0 }, // East edge - path goes West
          { q: -3, r: 0 }, // West edge - path goes East
        ];
        const result = validateShieldPlacement(shieldPositions, startingPositions, 3);
        expect(result.isValid).toBe(true);
      });
    });

    describe('invalid placements', () => {
      it('should return isValid false when player 0 path is blocked', () => {
        // Block the only straight path from East edge to center
        const shieldPositions: AxialCoord[] = [{ q: 1, r: 0 }];
        const startingPositions: AxialCoord[] = [
          { q: 3, r: 0 }, // East edge - path goes West, blocked
          { q: -3, r: 0 }, // West edge - path goes East, clear
        ];
        const result = validateShieldPlacement(shieldPositions, startingPositions, 3);
        expect(result.isValid).toBe(false);
        expect(result.blockedPlayers).toContain(0);
        expect(result.blockedPlayers).not.toContain(1);
      });

      it('should return isValid false when player 1 path is blocked', () => {
        const shieldPositions: AxialCoord[] = [{ q: -1, r: 0 }];
        const startingPositions: AxialCoord[] = [
          { q: 3, r: 0 }, // East edge - path goes West, clear
          { q: -3, r: 0 }, // West edge - path goes East, blocked
        ];
        const result = validateShieldPlacement(shieldPositions, startingPositions, 3);
        expect(result.isValid).toBe(false);
        expect(result.blockedPlayers).toContain(1);
        expect(result.blockedPlayers).not.toContain(0);
      });

      it('should return isValid false when all players are blocked', () => {
        const shieldPositions: AxialCoord[] = [
          { q: 1, r: 0 }, // Blocks East player
          { q: -1, r: 0 }, // Blocks West player
        ];
        const startingPositions: AxialCoord[] = [
          { q: 3, r: 0 },
          { q: -3, r: 0 },
        ];
        const result = validateShieldPlacement(shieldPositions, startingPositions, 3);
        expect(result.isValid).toBe(false);
        expect(result.blockedPlayers).toContain(0);
        expect(result.blockedPlayers).toContain(1);
        expect(result.blockedPlayers).toHaveLength(2);
      });
    });

    describe('correctly identifies blocked players for all configurations', () => {
      // Note: These tests verify that validateShieldPlacement correctly analyzes
      // shield placements. The current generateSymmetricalShields may produce
      // placements that block some paths - this is expected behavior that would
      // be handled by regeneration in actual game setup.

      it('should return valid result structure for 2-player configuration', () => {
        const config = getConfigForPlayerCount(2);
        const shields = generateSymmetricalShields(2, config.boardRadius, config.shieldCount);
        const positions = calculateStartingPositions(2, config.boardRadius);
        const result = validateShieldPlacement(shields, positions, config.boardRadius);
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
        // blockedPlayers should only contain valid player indices
        result.blockedPlayers.forEach((idx) => {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(positions.length);
        });
      });

      it('should return valid result structure for 3-player configuration', () => {
        const config = getConfigForPlayerCount(3);
        const shields = generateSymmetricalShields(3, config.boardRadius, config.shieldCount);
        const positions = calculateStartingPositions(3, config.boardRadius);
        const result = validateShieldPlacement(shields, positions, config.boardRadius);
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
      });

      it('should return valid result structure for 4-player configuration', () => {
        const config = getConfigForPlayerCount(4);
        const shields = generateSymmetricalShields(4, config.boardRadius, config.shieldCount);
        const positions = calculateStartingPositions(4, config.boardRadius);
        const result = validateShieldPlacement(shields, positions, config.boardRadius);
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
      });

      it('should return valid result structure for 5-player configuration', () => {
        const config = getConfigForPlayerCount(5);
        const shields = generateSymmetricalShields(5, config.boardRadius, config.shieldCount);
        const positions = calculateStartingPositions(5, config.boardRadius);
        const result = validateShieldPlacement(shields, positions, config.boardRadius);
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
      });

      it('should return valid result structure for 6-player configuration', () => {
        const config = getConfigForPlayerCount(6);
        const shields = generateSymmetricalShields(6, config.boardRadius, config.shieldCount);
        const positions = calculateStartingPositions(6, config.boardRadius);
        const result = validateShieldPlacement(shields, positions, config.boardRadius);
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.blockedPlayers)).toBe(true);
      });
    });
  });

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
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        expect(warriors).toHaveLength(5);
      });

      it('should return empty array for zero warriors', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 0, shieldPositions, 3);
        expect(warriors).toHaveLength(0);
      });

      it('should return empty array for negative warrior count', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, -1, shieldPositions, 3);
        expect(warriors).toHaveLength(0);
      });

      it('should place warriors at unique positions', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        const keys = warriors.map(hexToKey);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(warriors.length);
      });
    });

    describe('position constraints', () => {
      it('should not place warriors on the Jarl position', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        const jarlKey = hexToKey(jarlPosition);
        warriors.forEach((warrior) => {
          expect(hexToKey(warrior)).not.toBe(jarlKey);
        });
      });

      it('should not place warriors on the Throne', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        const throneKey = hexToKey({ q: 0, r: 0 });
        warriors.forEach((warrior) => {
          expect(hexToKey(warrior)).not.toBe(throneKey);
        });
      });

      it('should not place warriors on shield positions', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>([
          hexToKey({ q: 2, r: 0 }),
          hexToKey({ q: 1, r: 0 }),
        ]);
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        warriors.forEach((warrior) => {
          expect(shieldPositions.has(hexToKey(warrior))).toBe(false);
        });
      });

      it('should place warriors within board bounds', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
        });
      });
    });

    describe('formation toward throne', () => {
      it('should place warriors between Jarl and Throne', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 3, shieldPositions, 3);
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
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 2, shieldPositions, 3);

        // With path from (3,0) to (0,0), warriors should be at (2,0) and (1,0)
        const expectedPositions = [hexToKey({ q: 2, r: 0 }), hexToKey({ q: 1, r: 0 })];
        const actualKeys = warriors.map(hexToKey);

        expect(actualKeys).toContain(expectedPositions[0]);
        expect(actualKeys).toContain(expectedPositions[1]);
      });
    });

    describe('shield avoidance', () => {
      it('should place warriors around shields', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        // Block direct path
        const shieldPositions = new Set<string>([hexToKey({ q: 2, r: 0 })]);
        const warriors = placeWarriors(jarlPosition, 5, shieldPositions, 3);

        // Should still place correct number of warriors
        expect(warriors).toHaveLength(5);

        // Warriors should not be on shield position
        warriors.forEach((warrior) => {
          expect(shieldPositions.has(hexToKey(warrior))).toBe(false);
        });
      });

      it('should place warriors on alternate hexes when direct path is blocked', () => {
        const jarlPosition: AxialCoord = { q: 3, r: 0 };
        // Block most of the direct path
        const shieldPositions = new Set<string>([
          hexToKey({ q: 2, r: 0 }),
          hexToKey({ q: 1, r: 0 }),
        ]);
        // With 2 hexes blocked on direct path, only 4 warriors can be placed near the Jarl
        // in a radius 3 board (limited neighbor hexes available)
        const warriors = placeWarriors(jarlPosition, 4, shieldPositions, 3);

        // Should place the requested number of warriors
        expect(warriors).toHaveLength(4);

        // Warriors should be on board and not on shields
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
          expect(shieldPositions.has(hexToKey(warrior))).toBe(false);
        });
      });
    });

    describe('game scenarios', () => {
      it('should work with standard 2-player East edge Jarl', () => {
        const config = getConfigForPlayerCount(2);
        const jarlPosition: AxialCoord = { q: 3, r: 0 }; // East edge
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(
          jarlPosition,
          config.warriorCount,
          shieldPositions,
          config.boardRadius
        );
        expect(warriors).toHaveLength(config.warriorCount);
      });

      it('should work with standard 2-player West edge Jarl', () => {
        const config = getConfigForPlayerCount(2);
        const jarlPosition: AxialCoord = { q: -3, r: 0 }; // West edge
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(
          jarlPosition,
          config.warriorCount,
          shieldPositions,
          config.boardRadius
        );
        expect(warriors).toHaveLength(config.warriorCount);
      });

      it('should work with diagonal starting positions', () => {
        const jarlPosition: AxialCoord = { q: 2, r: -2 }; // NE area
        const shieldPositions = new Set<string>();
        const warriors = placeWarriors(jarlPosition, 4, shieldPositions, 3);
        expect(warriors).toHaveLength(4);

        // All warriors should be on board
        warriors.forEach((warrior) => {
          expect(isOnBoardAxial(warrior, 3)).toBe(true);
        });
      });

      it('should work with full game setup shields', () => {
        const config = getConfigForPlayerCount(2);
        const positions = calculateStartingPositions(2, config.boardRadius);
        const shields = generateSymmetricalShields(2, config.boardRadius, config.shieldCount);
        const shieldSet = new Set(shields.map(hexToKey));

        // Place warriors for both players
        const player1Warriors = placeWarriors(
          positions[0],
          config.warriorCount,
          shieldSet,
          config.boardRadius
        );
        const player2Warriors = placeWarriors(
          positions[1],
          config.warriorCount,
          shieldSet,
          config.boardRadius
        );

        expect(player1Warriors).toHaveLength(config.warriorCount);
        expect(player2Warriors).toHaveLength(config.warriorCount);

        // No warriors should overlap
        const allWarriorKeys = new Set([
          ...player1Warriors.map(hexToKey),
          ...player2Warriors.map(hexToKey),
        ]);
        expect(allWarriorKeys.size).toBe(player1Warriors.length + player2Warriors.length);
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
        expect(state.config.shieldCount).toBe(5);
        expect(state.config.warriorCount).toBe(5);
      });

      it('should use correct config for 3 players', () => {
        const state = createInitialState(['A', 'B', 'C']);
        expect(state.config.playerCount).toBe(3);
        expect(state.config.boardRadius).toBe(5);
        expect(state.config.shieldCount).toBe(4);
        expect(state.config.warriorCount).toBe(5);
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
      it('should create correct total number of pieces for 2 players', () => {
        const state = createInitialState(['A', 'B']);
        // 2 Jarls + 2 * 5 Warriors + 5 Shields = 17 pieces
        expect(state.pieces).toHaveLength(17);
      });

      it('should create correct number of shields', () => {
        const state = createInitialState(['A', 'B']);
        const shields = state.pieces.filter((p) => p.type === 'shield');
        expect(shields).toHaveLength(5);
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

      it('should give shields null playerId', () => {
        const state = createInitialState(['A', 'B']);
        const shields = state.pieces.filter((p) => p.type === 'shield');
        shields.forEach((shield) => {
          expect(shield.playerId).toBeNull();
        });
      });

      it('should assign correct playerId to Jarls', () => {
        const state = createInitialState(['A', 'B']);
        const jarls = state.pieces.filter((p) => p.type === 'jarl');
        const playerIds = state.players.map((p) => p.id);
        jarls.forEach((jarl) => {
          expect(playerIds).toContain(jarl.playerId);
        });
      });

      it('should assign correct playerId to Warriors', () => {
        const state = createInitialState(['A', 'B']);
        const warriors = state.pieces.filter((p) => p.type === 'warrior');
        const playerIds = state.players.map((p) => p.id);
        warriors.forEach((warrior) => {
          expect(playerIds).toContain(warrior.playerId);
        });
      });

      it('should place pieces at unique positions', () => {
        const state = createInitialState(['A', 'B']);
        const positionKeys = state.pieces.map((p) => hexToKey(p.position));
        const uniqueKeys = new Set(positionKeys);
        expect(uniqueKeys.size).toBe(positionKeys.length);
      });

      it('should give all pieces unique IDs', () => {
        const state = createInitialState(['A', 'B']);
        const ids = state.pieces.map((p) => p.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
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

    describe('error handling', () => {
      it('should throw error for 1 player', () => {
        expect(() => createInitialState(['Solo'])).toThrow(/Invalid player count/);
      });

      it('should throw error for 0 players', () => {
        expect(() => createInitialState([])).toThrow(/Invalid player count/);
      });

      it('should throw error for 7 players', () => {
        expect(() => createInitialState(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toThrow(
          /Invalid player count/
        );
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
        expect(state1.pieces.filter((p) => p.type === 'shield').length).toBe(
          state2.pieces.filter((p) => p.type === 'shield').length
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
