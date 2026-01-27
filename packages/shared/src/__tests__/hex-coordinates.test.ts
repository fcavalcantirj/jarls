import {
  DIRECTIONS,
  HexDirection,
  axialToCube,
  cubeToAxial,
  hexDistance,
  hexDistanceAxial,
  getAllNeighbors,
  isOnBoard,
  isOnBoardAxial,
  isOnEdge,
  isOnEdgeAxial,
  hexToKey,
  keyToHex,
  keyToHexCube,
  AxialCoord,
  CubeCoord,
} from '../index';

describe('hex-coordinates', () => {
  describe('HexDirection and DIRECTIONS', () => {
    it('should have exactly 6 directions', () => {
      expect(DIRECTIONS).toHaveLength(6);
    });

    it('should have direction vectors that satisfy cube coordinate constraint (q + r + s = 0)', () => {
      for (const dir of DIRECTIONS) {
        expect(dir.q + dir.r + dir.s).toBe(0);
      }
    });

    it('should have direction vectors with magnitude 1 (unit vectors)', () => {
      for (const dir of DIRECTIONS) {
        // In cube coordinates, adjacent hexes differ by exactly 1 in two coordinates
        // and the sum of absolute values should be 2
        const magnitude = Math.abs(dir.q) + Math.abs(dir.r) + Math.abs(dir.s);
        expect(magnitude).toBe(2);
      }
    });

    it('should have all directions be unique', () => {
      const keys = DIRECTIONS.map((d) => `${d.q},${d.r},${d.s}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(6);
    });

    it('should follow consistent hexagonal ordering (counter-clockwise from East)', () => {
      // Direction 0 (East): q increases
      expect(DIRECTIONS[0]).toEqual({ q: 1, r: 0, s: -1 });
      // Direction 3 (West): q decreases (opposite of East)
      expect(DIRECTIONS[3]).toEqual({ q: -1, r: 0, s: 1 });
    });

    it('should allow HexDirection type to be used as index', () => {
      const dir: HexDirection = 0;
      const vector = DIRECTIONS[dir];
      expect(vector).toBeDefined();
      expect(vector.q).toBe(1);
    });
  });

  describe('axialToCube', () => {
    it('should convert origin (0, 0) to (0, 0, 0)', () => {
      const axial: AxialCoord = { q: 0, r: 0 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ q: 0, r: 0, s: 0 });
    });

    it('should convert (1, 0) to (1, 0, -1)', () => {
      const axial: AxialCoord = { q: 1, r: 0 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ q: 1, r: 0, s: -1 });
    });

    it('should convert (0, 1) to (0, 1, -1)', () => {
      const axial: AxialCoord = { q: 0, r: 1 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ q: 0, r: 1, s: -1 });
    });

    it('should convert negative coordinates correctly', () => {
      const axial: AxialCoord = { q: -2, r: -1 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ q: -2, r: -1, s: 3 });
    });

    it('should produce cube coordinates satisfying q + r + s = 0', () => {
      const testCases: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 3, r: -2 },
        { q: -5, r: 7 },
      ];
      for (const axial of testCases) {
        const cube = axialToCube(axial);
        expect(cube.q + cube.r + cube.s).toBe(0);
      }
    });
  });

  describe('cubeToAxial', () => {
    it('should convert origin (0, 0, 0) to (0, 0)', () => {
      const cube: CubeCoord = { q: 0, r: 0, s: 0 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: 0, r: 0 });
    });

    it('should convert (1, 0, -1) to (1, 0)', () => {
      const cube: CubeCoord = { q: 1, r: 0, s: -1 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: 1, r: 0 });
    });

    it('should convert (0, 1, -1) to (0, 1)', () => {
      const cube: CubeCoord = { q: 0, r: 1, s: -1 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: 0, r: 1 });
    });

    it('should convert negative coordinates correctly', () => {
      const cube: CubeCoord = { q: -2, r: -1, s: 3 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: -2, r: -1 });
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve values when converting axial -> cube -> axial', () => {
      const testCases: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 3, r: -2 },
        { q: -5, r: 7 },
        { q: 10, r: -10 },
      ];
      for (const original of testCases) {
        const cube = axialToCube(original);
        const result = cubeToAxial(cube);
        expect(result).toEqual(original);
      }
    });

    it('should preserve q and r when converting cube -> axial -> cube', () => {
      const testCases: CubeCoord[] = [
        { q: 0, r: 0, s: 0 },
        { q: 1, r: 0, s: -1 },
        { q: 0, r: 1, s: -1 },
        { q: -1, r: 0, s: 1 },
        { q: 0, r: -1, s: 1 },
        { q: 3, r: -2, s: -1 },
        { q: -5, r: 7, s: -2 },
      ];
      for (const original of testCases) {
        const axial = cubeToAxial(original);
        const result = axialToCube(axial);
        expect(result.q).toBe(original.q);
        expect(result.r).toBe(original.r);
        // s is recalculated and should satisfy the constraint q + r + s = 0
        expect(result.q + result.r + result.s).toBe(0);
      }
    });
  });

  describe('hexDistance', () => {
    it('should return 0 for distance from hex to itself', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      expect(hexDistance(origin, origin)).toBe(0);

      const otherHex: CubeCoord = { q: 3, r: -1, s: -2 };
      expect(hexDistance(otherHex, otherHex)).toBe(0);
    });

    it('should return 1 for adjacent hexes', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };

      // Test all 6 adjacent hexes
      for (const dir of DIRECTIONS) {
        const adjacent: CubeCoord = {
          q: origin.q + dir.q,
          r: origin.r + dir.r,
          s: origin.s + dir.s,
        };
        expect(hexDistance(origin, adjacent)).toBe(1);
      }
    });

    it('should return 2 for hexes two steps away', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };

      // Moving 2 hexes East: (0,0,0) -> (1,0,-1) -> (2,0,-2)
      const twoEast: CubeCoord = { q: 2, r: 0, s: -2 };
      expect(hexDistance(origin, twoEast)).toBe(2);

      // Moving 2 hexes Northwest: (0,0,0) -> (0,-1,1) -> (0,-2,2)
      const twoNW: CubeCoord = { q: 0, r: -2, s: 2 };
      expect(hexDistance(origin, twoNW)).toBe(2);
    });

    it('should return 3 for hexes three steps away (board radius)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };

      // Edge of radius-3 board
      const edge: CubeCoord = { q: 3, r: 0, s: -3 };
      expect(hexDistance(origin, edge)).toBe(3);

      // Another edge position
      const edge2: CubeCoord = { q: 0, r: 3, s: -3 };
      expect(hexDistance(origin, edge2)).toBe(3);
    });

    it('should be symmetric (distance a to b equals distance b to a)', () => {
      const a: CubeCoord = { q: 2, r: -1, s: -1 };
      const b: CubeCoord = { q: -1, r: 3, s: -2 };

      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });

    it('should handle negative coordinates', () => {
      const a: CubeCoord = { q: -2, r: -1, s: 3 };
      const b: CubeCoord = { q: 1, r: 2, s: -3 };

      // Manhattan distance: |(-2)-1| + |(-1)-2| + |3-(-3)| = 3 + 3 + 6 = 12
      // Hex distance = 12 / 2 = 6
      expect(hexDistance(a, b)).toBe(6);
    });

    it('should calculate correct distance for diagonal movement', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };

      // Diagonal path that requires multiple direction changes
      const diagonal: CubeCoord = { q: 2, r: 2, s: -4 };
      expect(hexDistance(origin, diagonal)).toBe(4);
    });
  });

  describe('hexDistanceAxial', () => {
    it('should return 0 for distance from hex to itself', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      expect(hexDistanceAxial(origin, origin)).toBe(0);
    });

    it('should return 1 for adjacent hexes', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      const adjacent: AxialCoord = { q: 1, r: 0 };
      expect(hexDistanceAxial(origin, adjacent)).toBe(1);
    });

    it('should match hexDistance when using equivalent coordinates', () => {
      const axialA: AxialCoord = { q: 2, r: -1 };
      const axialB: AxialCoord = { q: -1, r: 3 };

      const cubeA = axialToCube(axialA);
      const cubeB = axialToCube(axialB);

      expect(hexDistanceAxial(axialA, axialB)).toBe(hexDistance(cubeA, cubeB));
    });

    it('should calculate correct distances for common game scenarios', () => {
      // Jarl at edge (radius 3) to Throne at center
      const edge: AxialCoord = { q: 3, r: 0 };
      const throne: AxialCoord = { q: 0, r: 0 };
      expect(hexDistanceAxial(edge, throne)).toBe(3);

      // Opposite edges of the board
      const eastEdge: AxialCoord = { q: 3, r: 0 };
      const westEdge: AxialCoord = { q: -3, r: 0 };
      expect(hexDistanceAxial(eastEdge, westEdge)).toBe(6);
    });
  });

  describe('isOnBoard', () => {
    const radius3 = 3; // 2-player board radius

    it('should return true for the center hex (Throne)', () => {
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      expect(isOnBoard(center, radius3)).toBe(true);
    });

    it('should return true for hexes within the board radius', () => {
      // Distance 1 from center
      expect(isOnBoard({ q: 1, r: 0, s: -1 }, radius3)).toBe(true);
      // Distance 2 from center
      expect(isOnBoard({ q: 2, r: 0, s: -2 }, radius3)).toBe(true);
      // Distance 3 from center (edge)
      expect(isOnBoard({ q: 3, r: 0, s: -3 }, radius3)).toBe(true);
    });

    it('should return false for hexes outside the board radius', () => {
      // Distance 4 from center
      expect(isOnBoard({ q: 4, r: 0, s: -4 }, radius3)).toBe(false);
      // Distance 5 from center
      expect(isOnBoard({ q: 5, r: 0, s: -5 }, radius3)).toBe(false);
      // Various out-of-bounds positions
      expect(isOnBoard({ q: 2, r: 2, s: -4 }, radius3)).toBe(false);
      expect(isOnBoard({ q: -4, r: 1, s: 3 }, radius3)).toBe(false);
    });

    it('should return true for all hexes exactly at the edge', () => {
      // Test all 6 cardinal edge positions at radius 3
      const edgePositions: CubeCoord[] = [
        { q: 3, r: 0, s: -3 }, // East
        { q: 3, r: -3, s: 0 }, // Northeast
        { q: 0, r: -3, s: 3 }, // Northwest
        { q: -3, r: 0, s: 3 }, // West
        { q: -3, r: 3, s: 0 }, // Southwest
        { q: 0, r: 3, s: -3 }, // Southeast
      ];

      for (const hex of edgePositions) {
        expect(isOnBoard(hex, radius3)).toBe(true);
      }
    });

    it('should handle radius 0 (single hex board)', () => {
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      const adjacent: CubeCoord = { q: 1, r: 0, s: -1 };

      expect(isOnBoard(center, 0)).toBe(true);
      expect(isOnBoard(adjacent, 0)).toBe(false);
    });

    it('should handle different board sizes', () => {
      // Radius 1
      expect(isOnBoard({ q: 1, r: 0, s: -1 }, 1)).toBe(true);
      expect(isOnBoard({ q: 2, r: 0, s: -2 }, 1)).toBe(false);

      // Radius 5
      expect(isOnBoard({ q: 5, r: 0, s: -5 }, 5)).toBe(true);
      expect(isOnBoard({ q: 6, r: 0, s: -6 }, 5)).toBe(false);
    });

    it('should handle negative coordinate positions', () => {
      expect(isOnBoard({ q: -2, r: -1, s: 3 }, radius3)).toBe(true);
      expect(isOnBoard({ q: -3, r: 2, s: 1 }, radius3)).toBe(true);
      expect(isOnBoard({ q: -4, r: 2, s: 2 }, radius3)).toBe(false);
    });
  });

  describe('isOnBoardAxial', () => {
    const radius3 = 3;

    it('should return true for the center hex', () => {
      const center: AxialCoord = { q: 0, r: 0 };
      expect(isOnBoardAxial(center, radius3)).toBe(true);
    });

    it('should return true for hexes within the board', () => {
      expect(isOnBoardAxial({ q: 2, r: -1 }, radius3)).toBe(true);
      expect(isOnBoardAxial({ q: -1, r: 2 }, radius3)).toBe(true);
    });

    it('should return false for hexes outside the board', () => {
      expect(isOnBoardAxial({ q: 4, r: 0 }, radius3)).toBe(false);
      expect(isOnBoardAxial({ q: -4, r: 1 }, radius3)).toBe(false);
    });

    it('should be consistent with cube coordinate version', () => {
      const testCases: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 3, r: 0 },
        { q: 4, r: 0 },
        { q: -2, r: 1 },
        { q: 1, r: -3 },
      ];

      for (const axial of testCases) {
        const cube = axialToCube(axial);
        expect(isOnBoardAxial(axial, radius3)).toBe(isOnBoard(cube, radius3));
      }
    });
  });

  describe('isOnEdge', () => {
    const radius3 = 3;

    it('should return false for the center hex', () => {
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      expect(isOnEdge(center, radius3)).toBe(false);
    });

    it('should return false for hexes inside the board but not on edge', () => {
      // Distance 1 from center
      expect(isOnEdge({ q: 1, r: 0, s: -1 }, radius3)).toBe(false);
      // Distance 2 from center
      expect(isOnEdge({ q: 2, r: 0, s: -2 }, radius3)).toBe(false);
      expect(isOnEdge({ q: 1, r: 1, s: -2 }, radius3)).toBe(false);
    });

    it('should return true for hexes exactly at the edge', () => {
      // Distance 3 from center (edge of radius-3 board)
      expect(isOnEdge({ q: 3, r: 0, s: -3 }, radius3)).toBe(true);
      expect(isOnEdge({ q: -3, r: 0, s: 3 }, radius3)).toBe(true);
      expect(isOnEdge({ q: 0, r: 3, s: -3 }, radius3)).toBe(true);
      expect(isOnEdge({ q: 0, r: -3, s: 3 }, radius3)).toBe(true);
      expect(isOnEdge({ q: 2, r: 1, s: -3 }, radius3)).toBe(true);
      expect(isOnEdge({ q: -1, r: -2, s: 3 }, radius3)).toBe(true);
    });

    it('should return false for hexes outside the board', () => {
      // Distance 4 from center
      expect(isOnEdge({ q: 4, r: 0, s: -4 }, radius3)).toBe(false);
      expect(isOnEdge({ q: -4, r: 2, s: 2 }, radius3)).toBe(false);
    });

    it('should count all edge hexes correctly for radius 3', () => {
      // For radius r, there are 6r edge hexes (for r > 0)
      // For radius 3, there should be 18 edge hexes
      let edgeCount = 0;

      // Iterate through all hexes that could potentially be on board
      for (let q = -radius3; q <= radius3; q++) {
        for (let r = -radius3; r <= radius3; r++) {
          const s = -q - r;
          const hex: CubeCoord = { q, r, s };
          if (isOnEdge(hex, radius3)) {
            edgeCount++;
          }
        }
      }

      expect(edgeCount).toBe(6 * radius3);
    });

    it('should handle radius 1 board', () => {
      // Radius 1 has 6 edge hexes
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      expect(isOnEdge(center, 1)).toBe(false);

      // All 6 neighbors of center are on edge
      const neighbors = getAllNeighbors(center);
      for (const neighbor of neighbors) {
        expect(isOnEdge(neighbor, 1)).toBe(true);
      }
    });

    it('should handle radius 0 (single hex board)', () => {
      const center: CubeCoord = { q: 0, r: 0, s: 0 };
      // In a radius-0 board, the only hex is both the center and the edge
      expect(isOnEdge(center, 0)).toBe(true);
    });
  });

  describe('isOnEdgeAxial', () => {
    const radius3 = 3;

    it('should return false for the center hex', () => {
      const center: AxialCoord = { q: 0, r: 0 };
      expect(isOnEdgeAxial(center, radius3)).toBe(false);
    });

    it('should return true for edge hexes', () => {
      expect(isOnEdgeAxial({ q: 3, r: 0 }, radius3)).toBe(true);
      expect(isOnEdgeAxial({ q: -3, r: 0 }, radius3)).toBe(true);
      expect(isOnEdgeAxial({ q: 0, r: 3 }, radius3)).toBe(true);
    });

    it('should be consistent with cube coordinate version', () => {
      const testCases: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        { q: 4, r: 0 },
        { q: -2, r: -1 },
        { q: 1, r: 2 },
      ];

      for (const axial of testCases) {
        const cube = axialToCube(axial);
        expect(isOnEdgeAxial(axial, radius3)).toBe(isOnEdge(cube, radius3));
      }
    });
  });

  describe('isOnBoard and isOnEdge boundary cases', () => {
    it('should correctly identify Jarl starting positions as on edge', () => {
      // In a 2-player game, Jarls start at opposite edges at radius 3
      const jarl1: CubeCoord = { q: 3, r: 0, s: -3 };
      const jarl2: CubeCoord = { q: -3, r: 0, s: 3 };

      expect(isOnBoard(jarl1, 3)).toBe(true);
      expect(isOnBoard(jarl2, 3)).toBe(true);
      expect(isOnEdge(jarl1, 3)).toBe(true);
      expect(isOnEdge(jarl2, 3)).toBe(true);
    });

    it('should correctly identify Throne as on board but not on edge', () => {
      const throne: CubeCoord = { q: 0, r: 0, s: 0 };

      expect(isOnBoard(throne, 3)).toBe(true);
      expect(isOnEdge(throne, 3)).toBe(false);
    });

    it('should identify pushed-off pieces as outside board', () => {
      // A piece pushed off the East edge
      const pushedOff: CubeCoord = { q: 4, r: 0, s: -4 };

      expect(isOnBoard(pushedOff, 3)).toBe(false);
      expect(isOnEdge(pushedOff, 3)).toBe(false);
    });

    it('should work for all hexes adjacent to edge hexes', () => {
      // For each edge hex, verify neighbors are either on edge, inside, or outside
      const edgeHex: CubeCoord = { q: 3, r: 0, s: -3 };
      const neighbors = getAllNeighbors(edgeHex);

      for (const neighbor of neighbors) {
        const onBoard = isOnBoard(neighbor, 3);
        const onEdge = isOnEdge(neighbor, 3);

        // If on edge, must be on board
        if (onEdge) {
          expect(onBoard).toBe(true);
        }

        // If not on board, cannot be on edge
        if (!onBoard) {
          expect(onEdge).toBe(false);
        }
      }
    });
  });

  describe('hexToKey', () => {
    it('should convert origin to "0,0"', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      expect(hexToKey(origin)).toBe('0,0');
    });

    it('should convert positive coordinates correctly', () => {
      const hex: AxialCoord = { q: 3, r: 2 };
      expect(hexToKey(hex)).toBe('3,2');
    });

    it('should convert negative coordinates correctly', () => {
      const hex: AxialCoord = { q: -2, r: -5 };
      expect(hexToKey(hex)).toBe('-2,-5');
    });

    it('should convert mixed positive/negative coordinates', () => {
      const hex: AxialCoord = { q: 3, r: -1 };
      expect(hexToKey(hex)).toBe('3,-1');
    });

    it('should work with cube coordinates', () => {
      const cube: CubeCoord = { q: 2, r: -1, s: -1 };
      // Should use only q and r, ignoring s
      expect(hexToKey(cube)).toBe('2,-1');
    });

    it('should produce unique keys for different hexes', () => {
      const hexes: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 1, r: -1 },
        { q: -1, r: 1 },
        { q: 3, r: 2 },
        { q: 2, r: 3 },
      ];

      const keys = hexes.map(hexToKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(hexes.length);
    });

    it('should produce consistent keys for same hex', () => {
      const hex: AxialCoord = { q: 5, r: -3 };
      expect(hexToKey(hex)).toBe(hexToKey(hex));
      expect(hexToKey(hex)).toBe(hexToKey({ q: 5, r: -3 }));
    });
  });

  describe('keyToHex', () => {
    it('should convert "0,0" to origin', () => {
      const result = keyToHex('0,0');
      expect(result).toEqual({ q: 0, r: 0 });
    });

    it('should convert positive coordinate keys', () => {
      const result = keyToHex('3,2');
      expect(result).toEqual({ q: 3, r: 2 });
    });

    it('should convert negative coordinate keys', () => {
      const result = keyToHex('-2,-5');
      expect(result).toEqual({ q: -2, r: -5 });
    });

    it('should convert mixed coordinate keys', () => {
      const result = keyToHex('3,-1');
      expect(result).toEqual({ q: 3, r: -1 });
    });

    it('should return null for invalid keys with wrong format', () => {
      expect(keyToHex('')).toBeNull();
      expect(keyToHex('1')).toBeNull();
      expect(keyToHex('1,2,3')).toBeNull();
      expect(keyToHex('abc')).toBeNull();
    });

    it('should return null for non-numeric values', () => {
      expect(keyToHex('a,b')).toBeNull();
      expect(keyToHex('1,b')).toBeNull();
      expect(keyToHex('a,2')).toBeNull();
    });

    it('should handle large coordinate values', () => {
      const result = keyToHex('1000,-999');
      expect(result).toEqual({ q: 1000, r: -999 });
    });
  });

  describe('keyToHexCube', () => {
    it('should convert "0,0" to cube origin', () => {
      const result = keyToHexCube('0,0');
      expect(result).toEqual({ q: 0, r: 0, s: 0 });
    });

    it('should convert keys to valid cube coordinates', () => {
      const result = keyToHexCube('3,-1');
      expect(result).not.toBeNull();
      expect(result!.q + result!.r + result!.s).toBe(0);
      expect(result).toEqual({ q: 3, r: -1, s: -2 });
    });

    it('should return null for invalid keys', () => {
      expect(keyToHexCube('')).toBeNull();
      expect(keyToHexCube('invalid')).toBeNull();
      expect(keyToHexCube('1,2,3')).toBeNull();
    });

    it('should produce cube coordinates satisfying constraint', () => {
      const testKeys = ['0,0', '3,-1', '-2,5', '10,-10', '-5,-5'];

      for (const key of testKeys) {
        const result = keyToHexCube(key);
        expect(result).not.toBeNull();
        expect(result!.q + result!.r + result!.s).toBe(0);
      }
    });
  });

  describe('hexToKey and keyToHex round-trip', () => {
    it('should preserve axial coordinates through round-trip', () => {
      const testCases: AxialCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 3, r: -2 },
        { q: -5, r: 7 },
        { q: 100, r: -50 },
      ];

      for (const original of testCases) {
        const key = hexToKey(original);
        const result = keyToHex(key);
        expect(result).toEqual(original);
      }
    });

    it('should preserve cube coordinates (q, r) through round-trip', () => {
      const testCases: CubeCoord[] = [
        { q: 0, r: 0, s: 0 },
        { q: 1, r: 0, s: -1 },
        { q: 0, r: 1, s: -1 },
        { q: -1, r: 0, s: 1 },
        { q: 3, r: -2, s: -1 },
      ];

      for (const original of testCases) {
        const key = hexToKey(original);
        const result = keyToHexCube(key);
        expect(result).not.toBeNull();
        expect(result!.q).toBe(original.q);
        expect(result!.r).toBe(original.r);
        // s is recalculated and should satisfy the constraint
        expect(result!.q + result!.r + result!.s).toBe(0);
      }
    });
  });

  describe('hexToKey with Map storage', () => {
    it('should work correctly as Map keys', () => {
      const hexMap = new Map<string, string>();

      const hex1: AxialCoord = { q: 0, r: 0 };
      const hex2: AxialCoord = { q: 1, r: -1 };
      const hex3: AxialCoord = { q: -2, r: 3 };

      hexMap.set(hexToKey(hex1), 'throne');
      hexMap.set(hexToKey(hex2), 'warrior');
      hexMap.set(hexToKey(hex3), 'jarl');

      expect(hexMap.get(hexToKey(hex1))).toBe('throne');
      expect(hexMap.get(hexToKey(hex2))).toBe('warrior');
      expect(hexMap.get(hexToKey(hex3))).toBe('jarl');
      expect(hexMap.get(hexToKey({ q: 5, r: 5 }))).toBeUndefined();
    });

    it('should correctly identify same hex in Map', () => {
      const hexMap = new Map<string, number>();

      const hex: AxialCoord = { q: 2, r: -1 };
      hexMap.set(hexToKey(hex), 42);

      // Same hex, different object instance
      const sameHex: AxialCoord = { q: 2, r: -1 };
      expect(hexMap.get(hexToKey(sameHex))).toBe(42);
    });

    it('should handle game board scenario with pieces', () => {
      const boardState = new Map<string, { type: string; player: number }>();

      // Place some pieces
      const pieces = [
        { pos: { q: 0, r: 0 }, type: 'throne', player: 0 },
        { pos: { q: 3, r: 0 }, type: 'jarl', player: 1 },
        { pos: { q: -3, r: 0 }, type: 'jarl', player: 2 },
        { pos: { q: 2, r: 0 }, type: 'warrior', player: 1 },
        { pos: { q: 1, r: 0 }, type: 'warrior', player: 1 },
        { pos: { q: -2, r: 0 }, type: 'warrior', player: 2 },
      ];

      for (const piece of pieces) {
        boardState.set(hexToKey(piece.pos), { type: piece.type, player: piece.player });
      }

      expect(boardState.size).toBe(6);
      expect(boardState.get(hexToKey({ q: 3, r: 0 }))).toEqual({ type: 'jarl', player: 1 });
      expect(boardState.has(hexToKey({ q: 5, r: 5 }))).toBe(false);

      // Simulate moving a piece
      const oldPos: AxialCoord = { q: 2, r: 0 };
      const newPos: AxialCoord = { q: 2, r: -1 };
      const piece = boardState.get(hexToKey(oldPos));
      if (piece) {
        boardState.delete(hexToKey(oldPos));
        boardState.set(hexToKey(newPos), piece);
      }

      expect(boardState.has(hexToKey(oldPos))).toBe(false);
      expect(boardState.get(hexToKey(newPos))).toEqual({ type: 'warrior', player: 1 });
    });
  });
});
