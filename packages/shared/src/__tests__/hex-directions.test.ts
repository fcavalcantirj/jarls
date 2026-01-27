import {
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
} from '../index';

describe('hex-directions', () => {
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
