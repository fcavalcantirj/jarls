import { VERSION, DIRECTIONS, HexDirection } from './index';

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
});
