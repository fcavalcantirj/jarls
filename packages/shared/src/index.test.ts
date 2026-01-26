import {
  VERSION,
  DIRECTIONS,
  HexDirection,
  axialToCube,
  cubeToAxial,
  hexDistance,
  hexDistanceAxial,
  getNeighbor,
  getAllNeighbors,
  getNeighborAxial,
  getAllNeighborsAxial,
  getOppositeDirection,
  cubeRound,
  hexLine,
  hexLineAxial,
  AxialCoord,
  CubeCoord,
} from './index';

describe('@jarls/shared', () => {
  describe('VERSION', () => {
    it('should be defined', () => {
      expect(VERSION).toBeDefined();
    });

    it('should be a valid semver string', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

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

  describe('getNeighbor', () => {
    it('should return correct neighbor to the East (direction 0)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 0);
      expect(neighbor).toEqual({ q: 1, r: 0, s: -1 });
    });

    it('should return correct neighbor to the Northeast (direction 1)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 1);
      expect(neighbor).toEqual({ q: 1, r: -1, s: 0 });
    });

    it('should return correct neighbor to the Northwest (direction 2)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 2);
      expect(neighbor).toEqual({ q: 0, r: -1, s: 1 });
    });

    it('should return correct neighbor to the West (direction 3)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 3);
      expect(neighbor).toEqual({ q: -1, r: 0, s: 1 });
    });

    it('should return correct neighbor to the Southwest (direction 4)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 4);
      expect(neighbor).toEqual({ q: -1, r: 1, s: 0 });
    });

    it('should return correct neighbor to the Southeast (direction 5)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbor = getNeighbor(origin, 5);
      expect(neighbor).toEqual({ q: 0, r: 1, s: -1 });
    });

    it('should return neighbors that satisfy cube coordinate constraint', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      for (let dir = 0; dir < 6; dir++) {
        const neighbor = getNeighbor(hex, dir as HexDirection);
        expect(neighbor.q + neighbor.r + neighbor.s).toBe(0);
      }
    });

    it('should return neighbors at distance 1', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      for (let dir = 0; dir < 6; dir++) {
        const neighbor = getNeighbor(hex, dir as HexDirection);
        expect(hexDistance(hex, neighbor)).toBe(1);
      }
    });

    it('should work with negative coordinates', () => {
      const hex: CubeCoord = { q: -2, r: 3, s: -1 };
      const neighbor = getNeighbor(hex, 0); // East
      expect(neighbor).toEqual({ q: -1, r: 3, s: -2 });
    });

    it('should be inverse of opposite direction', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      // Going East then West should return to origin
      const east = getNeighbor(origin, 0);
      const backToOrigin = getNeighbor(east, 3);
      expect(backToOrigin).toEqual(origin);
    });
  });

  describe('getAllNeighbors', () => {
    it('should return exactly 6 neighbors', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbors = getAllNeighbors(origin);
      expect(neighbors).toHaveLength(6);
    });

    it('should return neighbors in correct order (matching DIRECTIONS)', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };
      const neighbors = getAllNeighbors(origin);

      expect(neighbors[0]).toEqual({ q: 1, r: 0, s: -1 }); // East
      expect(neighbors[1]).toEqual({ q: 1, r: -1, s: 0 }); // Northeast
      expect(neighbors[2]).toEqual({ q: 0, r: -1, s: 1 }); // Northwest
      expect(neighbors[3]).toEqual({ q: -1, r: 0, s: 1 }); // West
      expect(neighbors[4]).toEqual({ q: -1, r: 1, s: 0 }); // Southwest
      expect(neighbors[5]).toEqual({ q: 0, r: 1, s: -1 }); // Southeast
    });

    it('should return all unique neighbors', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const neighbors = getAllNeighbors(hex);
      const keys = neighbors.map((n) => `${n.q},${n.r},${n.s}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(6);
    });

    it('should return neighbors that all satisfy cube coordinate constraint', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const neighbors = getAllNeighbors(hex);
      for (const neighbor of neighbors) {
        expect(neighbor.q + neighbor.r + neighbor.s).toBe(0);
      }
    });

    it('should return neighbors that are all at distance 1', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const neighbors = getAllNeighbors(hex);
      for (const neighbor of neighbors) {
        expect(hexDistance(hex, neighbor)).toBe(1);
      }
    });

    it('should match individual getNeighbor calls', () => {
      const hex: CubeCoord = { q: 1, r: 2, s: -3 };
      const allNeighbors = getAllNeighbors(hex);

      for (let dir = 0; dir < 6; dir++) {
        const singleNeighbor = getNeighbor(hex, dir as HexDirection);
        expect(allNeighbors[dir]).toEqual(singleNeighbor);
      }
    });
  });

  describe('getNeighborAxial', () => {
    it('should return correct neighbor using axial coordinates', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      const neighbor = getNeighborAxial(origin, 0); // East
      expect(neighbor).toEqual({ q: 1, r: 0 });
    });

    it('should return neighbor at distance 1', () => {
      const hex: AxialCoord = { q: 2, r: -1 };
      for (let dir = 0; dir < 6; dir++) {
        const neighbor = getNeighborAxial(hex, dir as HexDirection);
        expect(hexDistanceAxial(hex, neighbor)).toBe(1);
      }
    });

    it('should be consistent with cube coordinate version', () => {
      const axial: AxialCoord = { q: 3, r: -2 };
      const cube = axialToCube(axial);

      for (let dir = 0; dir < 6; dir++) {
        const axialNeighbor = getNeighborAxial(axial, dir as HexDirection);
        const cubeNeighbor = getNeighbor(cube, dir as HexDirection);
        expect(axialNeighbor).toEqual(cubeToAxial(cubeNeighbor));
      }
    });
  });

  describe('getAllNeighborsAxial', () => {
    it('should return exactly 6 neighbors', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      const neighbors = getAllNeighborsAxial(origin);
      expect(neighbors).toHaveLength(6);
    });

    it('should return neighbors in correct order', () => {
      const origin: AxialCoord = { q: 0, r: 0 };
      const neighbors = getAllNeighborsAxial(origin);

      expect(neighbors[0]).toEqual({ q: 1, r: 0 }); // East
      expect(neighbors[1]).toEqual({ q: 1, r: -1 }); // Northeast
      expect(neighbors[2]).toEqual({ q: 0, r: -1 }); // Northwest
      expect(neighbors[3]).toEqual({ q: -1, r: 0 }); // West
      expect(neighbors[4]).toEqual({ q: -1, r: 1 }); // Southwest
      expect(neighbors[5]).toEqual({ q: 0, r: 1 }); // Southeast
    });

    it('should return all unique neighbors', () => {
      const hex: AxialCoord = { q: 2, r: -1 };
      const neighbors = getAllNeighborsAxial(hex);
      const keys = neighbors.map((n) => `${n.q},${n.r}`);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(6);
    });

    it('should return neighbors that are all at distance 1', () => {
      const hex: AxialCoord = { q: 2, r: -1 };
      const neighbors = getAllNeighborsAxial(hex);
      for (const neighbor of neighbors) {
        expect(hexDistanceAxial(hex, neighbor)).toBe(1);
      }
    });

    it('should match individual getNeighborAxial calls', () => {
      const hex: AxialCoord = { q: 1, r: 2 };
      const allNeighbors = getAllNeighborsAxial(hex);

      for (let dir = 0; dir < 6; dir++) {
        const singleNeighbor = getNeighborAxial(hex, dir as HexDirection);
        expect(allNeighbors[dir]).toEqual(singleNeighbor);
      }
    });

    it('should be consistent with cube coordinate version', () => {
      const axial: AxialCoord = { q: 3, r: -2 };
      const cube = axialToCube(axial);

      const axialNeighbors = getAllNeighborsAxial(axial);
      const cubeNeighbors = getAllNeighbors(cube);

      for (let i = 0; i < 6; i++) {
        expect(axialNeighbors[i]).toEqual(cubeToAxial(cubeNeighbors[i]));
      }
    });
  });

  describe('getOppositeDirection', () => {
    it('should return 3 (West) for direction 0 (East)', () => {
      expect(getOppositeDirection(0)).toBe(3);
    });

    it('should return 4 (Southwest) for direction 1 (Northeast)', () => {
      expect(getOppositeDirection(1)).toBe(4);
    });

    it('should return 5 (Southeast) for direction 2 (Northwest)', () => {
      expect(getOppositeDirection(2)).toBe(5);
    });

    it('should return 0 (East) for direction 3 (West)', () => {
      expect(getOppositeDirection(3)).toBe(0);
    });

    it('should return 1 (Northeast) for direction 4 (Southwest)', () => {
      expect(getOppositeDirection(4)).toBe(1);
    });

    it('should return 2 (Northwest) for direction 5 (Southeast)', () => {
      expect(getOppositeDirection(5)).toBe(2);
    });

    it('should be self-inverse (applying twice returns original)', () => {
      for (let dir = 0; dir < 6; dir++) {
        const opposite = getOppositeDirection(dir as HexDirection);
        const backToOriginal = getOppositeDirection(opposite);
        expect(backToOriginal).toBe(dir);
      }
    });

    it('should produce direction vectors that sum to zero', () => {
      for (let dir = 0; dir < 6; dir++) {
        const opposite = getOppositeDirection(dir as HexDirection);
        const dirVector = DIRECTIONS[dir];
        const oppVector = DIRECTIONS[opposite];

        // Opposite direction vectors should sum to (0, 0, 0)
        expect(dirVector.q + oppVector.q).toBe(0);
        expect(dirVector.r + oppVector.r).toBe(0);
        expect(dirVector.s + oppVector.s).toBe(0);
      }
    });

    it('should return a valid HexDirection type', () => {
      for (let dir = 0; dir < 6; dir++) {
        const opposite = getOppositeDirection(dir as HexDirection);
        expect(opposite).toBeGreaterThanOrEqual(0);
        expect(opposite).toBeLessThanOrEqual(5);
      }
    });

    it('should enable round-trip navigation back to origin', () => {
      const origin: CubeCoord = { q: 0, r: 0, s: 0 };

      for (let dir = 0; dir < 6; dir++) {
        const neighbor = getNeighbor(origin, dir as HexDirection);
        const opposite = getOppositeDirection(dir as HexDirection);
        const backToOrigin = getNeighbor(neighbor, opposite);
        expect(backToOrigin).toEqual(origin);
      }
    });
  });

  describe('cubeRound', () => {
    it('should round exact integer coordinates unchanged', () => {
      expect(cubeRound(1, 2, -3)).toEqual({ q: 1, r: 2, s: -3 });
      expect(cubeRound(0, 0, 0)).toEqual({ q: 0, r: 0, s: 0 });
    });

    it('should round fractional coordinates to nearest hex', () => {
      // Close to (1, 0, -1)
      expect(cubeRound(1.1, -0.1, -1.0)).toEqual({ q: 1, r: 0, s: -1 });
    });

    it('should maintain cube coordinate constraint (q + r + s = 0)', () => {
      const testCases = [
        [0.5, 0.5, -1.0],
        [1.3, -0.7, -0.6],
        [-0.9, 2.1, -1.2],
        [0.1, 0.1, -0.2],
      ];

      for (const [q, r, s] of testCases) {
        const result = cubeRound(q, r, s);
        expect(result.q + result.r + result.s).toBe(0);
      }
    });

    it('should handle edge cases near hex boundaries', () => {
      // Exactly between two hexes - should still satisfy constraint
      const result = cubeRound(0.5, -0.5, 0);
      expect(result.q + result.r + result.s).toBe(0);
    });
  });

  describe('hexLine', () => {
    it('should return single hex when start equals end', () => {
      const hex: CubeCoord = { q: 2, r: -1, s: -1 };
      const line = hexLine(hex, hex);
      expect(line).toHaveLength(1);
      expect(line[0]).toEqual(hex);
    });

    it('should return two hexes for adjacent hexes', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 1, r: 0, s: -1 }; // East neighbor
      const line = hexLine(start, end);
      expect(line).toHaveLength(2);
      expect(line[0]).toEqual(start);
      expect(line[1]).toEqual(end);
    });

    it('should include start and end hexes', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 3, r: 0, s: -3 }; // 3 hexes East
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
    });

    it('should return correct number of hexes (distance + 1)', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 3, r: 0, s: -3 };
      const line = hexLine(start, end);

      const distance = hexDistance(start, end);
      expect(line).toHaveLength(distance + 1);
    });

    it('should draw straight line East', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 3, r: 0, s: -3 };
      const line = hexLine(start, end);

      expect(line).toEqual([
        { q: 0, r: 0, s: 0 },
        { q: 1, r: 0, s: -1 },
        { q: 2, r: 0, s: -2 },
        { q: 3, r: 0, s: -3 },
      ]);
    });

    it('should draw straight line West', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: -3, r: 0, s: 3 };
      const line = hexLine(start, end);

      expect(line).toEqual([
        { q: 0, r: 0, s: 0 },
        { q: -1, r: 0, s: 1 },
        { q: -2, r: 0, s: 2 },
        { q: -3, r: 0, s: 3 },
      ]);
    });

    it('should draw straight line Northeast', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 2, r: -2, s: 0 };
      const line = hexLine(start, end);

      expect(line).toEqual([
        { q: 0, r: 0, s: 0 },
        { q: 1, r: -1, s: 0 },
        { q: 2, r: -2, s: 0 },
      ]);
    });

    it('should return hexes that all satisfy cube coordinate constraint', () => {
      const start: CubeCoord = { q: -2, r: 3, s: -1 };
      const end: CubeCoord = { q: 2, r: -1, s: -1 };
      const line = hexLine(start, end);

      for (const hex of line) {
        expect(hex.q + hex.r + hex.s).toBe(0);
      }
    });

    it('should have consecutive hexes at distance 1', () => {
      const start: CubeCoord = { q: -1, r: 2, s: -1 };
      const end: CubeCoord = { q: 2, r: -3, s: 1 };
      const line = hexLine(start, end);

      for (let i = 0; i < line.length - 1; i++) {
        expect(hexDistance(line[i], line[i + 1])).toBe(1);
      }
    });

    it('should handle diagonal lines correctly', () => {
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 2, r: 2, s: -4 };
      const line = hexLine(start, end);

      // Distance is 4, so should have 5 hexes
      expect(line).toHaveLength(5);
      expect(line[0]).toEqual(start);
      expect(line[4]).toEqual(end);

      // All consecutive pairs should be adjacent
      for (let i = 0; i < line.length - 1; i++) {
        expect(hexDistance(line[i], line[i + 1])).toBe(1);
      }
    });

    it('should handle lines with negative coordinates', () => {
      const start: CubeCoord = { q: -3, r: 1, s: 2 };
      const end: CubeCoord = { q: 1, r: -2, s: 1 };
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);

      for (let i = 0; i < line.length - 1; i++) {
        expect(hexDistance(line[i], line[i + 1])).toBe(1);
      }
    });

    it('should be symmetric (line from a to b equals reversed line from b to a)', () => {
      const a: CubeCoord = { q: 1, r: -2, s: 1 };
      const b: CubeCoord = { q: -2, r: 3, s: -1 };

      const lineAB = hexLine(a, b);
      const lineBA = hexLine(b, a);

      expect(lineAB).toHaveLength(lineBA.length);

      // Reversed lines should match
      const reversedBA = [...lineBA].reverse();
      for (let i = 0; i < lineAB.length; i++) {
        expect(lineAB[i]).toEqual(reversedBA[i]);
      }
    });

    it('should handle edge case lines that pass between hexes', () => {
      // This line passes exactly between hexes at some points
      const start: CubeCoord = { q: 0, r: 0, s: 0 };
      const end: CubeCoord = { q: 2, r: -1, s: -1 };
      const line = hexLine(start, end);

      // Should still produce valid line
      expect(line.length).toBeGreaterThan(0);
      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);

      // All hexes should satisfy constraint
      for (const hex of line) {
        expect(hex.q + hex.r + hex.s).toBe(0);
      }

      // All consecutive pairs should be adjacent
      for (let i = 0; i < line.length - 1; i++) {
        expect(hexDistance(line[i], line[i + 1])).toBe(1);
      }
    });
  });

  describe('hexLineAxial', () => {
    it('should return single hex when start equals end', () => {
      const hex: AxialCoord = { q: 2, r: -1 };
      const line = hexLineAxial(hex, hex);
      expect(line).toHaveLength(1);
      expect(line[0]).toEqual(hex);
    });

    it('should return two hexes for adjacent hexes', () => {
      const start: AxialCoord = { q: 0, r: 0 };
      const end: AxialCoord = { q: 1, r: 0 }; // East neighbor
      const line = hexLineAxial(start, end);
      expect(line).toHaveLength(2);
      expect(line[0]).toEqual(start);
      expect(line[1]).toEqual(end);
    });

    it('should be consistent with cube coordinate version', () => {
      const axialStart: AxialCoord = { q: -1, r: 2 };
      const axialEnd: AxialCoord = { q: 2, r: -1 };

      const cubeStart = axialToCube(axialStart);
      const cubeEnd = axialToCube(axialEnd);

      const axialLine = hexLineAxial(axialStart, axialEnd);
      const cubeLine = hexLine(cubeStart, cubeEnd);

      expect(axialLine).toHaveLength(cubeLine.length);

      for (let i = 0; i < axialLine.length; i++) {
        expect(axialLine[i]).toEqual(cubeToAxial(cubeLine[i]));
      }
    });

    it('should draw line for game scenario: Jarl to Throne', () => {
      const jarlPosition: AxialCoord = { q: 3, r: 0 }; // Edge position
      const throne: AxialCoord = { q: 0, r: 0 }; // Center

      const line = hexLineAxial(jarlPosition, throne);

      expect(line).toHaveLength(4); // distance 3 + 1
      expect(line[0]).toEqual(jarlPosition);
      expect(line[3]).toEqual(throne);
    });
  });
});
