import { generateRandomHoles, createInitialState, AxialCoord } from '../index';
import { hexToKey, hexDistance, isOnEdgeAxial } from '../hex';

describe('generateRandomHoles', () => {
  describe('hole count per terrain', () => {
    it('generates 3 holes for calm terrain', () => {
      const holes = generateRandomHoles(3, 'calm', []);
      expect(holes).toHaveLength(3);
    });

    it('generates 6 holes for treacherous terrain', () => {
      const holes = generateRandomHoles(3, 'treacherous', []);
      expect(holes).toHaveLength(6);
    });

    it('generates max available holes for chaotic terrain on radius-3 board', () => {
      // On a radius-3 board with 2-hex buffer, only 6 valid positions exist
      // (the 6 hexes adjacent to the throne)
      const holes = generateRandomHoles(3, 'chaotic', []);
      // Should generate up to 6 holes (all available positions)
      expect(holes.length).toBeLessThanOrEqual(6);
      expect(holes.length).toBeGreaterThan(0);
    });
  });

  describe('hole placement rules', () => {
    it('never places holes on the throne (0,0)', () => {
      // Run multiple times to check randomness
      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(3, 'chaotic', []);
        const throneHole = holes.find((h) => h.q === 0 && h.r === 0);
        expect(throneHole).toBeUndefined();
      }
    });

    it('never places holes on edge hexes', () => {
      const radius = 3;
      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(radius, 'chaotic', []);
        for (const hole of holes) {
          expect(isOnEdgeAxial(hole, radius)).toBe(false);
        }
      }
    });

    it('never places holes adjacent to edge hexes (2 hex buffer)', () => {
      const radius = 3;
      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(radius, 'chaotic', []);
        for (const hole of holes) {
          // Distance from center must be at most radius - 2 (2 hex buffer from edge)
          const distFromCenter = hexDistance(
            { q: hole.q, r: hole.r, s: -hole.q - hole.r },
            { q: 0, r: 0, s: 0 }
          );
          expect(distFromCenter).toBeLessThanOrEqual(radius - 2);
        }
      }
    });

    it('never places holes on starting positions', () => {
      const startingPositions: AxialCoord[] = [
        { q: 3, r: 0 },
        { q: -3, r: 0 },
      ];

      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(3, 'chaotic', startingPositions);
        for (const hole of holes) {
          const key = hexToKey(hole);
          const onStarting = startingPositions.some((s) => hexToKey(s) === key);
          expect(onStarting).toBe(false);
        }
      }
    });

    it('generates unique hole positions (no duplicates)', () => {
      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(3, 'chaotic', []);
        const keys = holes.map(hexToKey);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(holes.length);
      }
    });
  });

  describe('randomness', () => {
    it('generates different positions on different calls', () => {
      const allHoleSets: string[] = [];

      for (let i = 0; i < 10; i++) {
        const holes = generateRandomHoles(3, 'calm', []);
        const sortedKeys = holes.map(hexToKey).sort().join(',');
        allHoleSets.push(sortedKeys);
      }

      // At least some should be different (not all identical)
      const uniqueSets = new Set(allHoleSets);
      expect(uniqueSets.size).toBeGreaterThan(1);
    });
  });
});

describe('createInitialState with terrain', () => {
  it('creates a game state with holes array', () => {
    const state = createInitialState(['Player 1', 'Player 2'], null, undefined, 'calm');
    expect(state.holes).toBeDefined();
    expect(Array.isArray(state.holes)).toBe(true);
  });

  it('defaults to calm terrain when not specified', () => {
    const state = createInitialState(['Player 1', 'Player 2']);
    expect(state.holes).toBeDefined();
    expect(state.holes).toHaveLength(3); // calm = 3 holes
  });

  it('stores terrain type in config', () => {
    const state = createInitialState(['Player 1', 'Player 2'], null, undefined, 'treacherous');
    expect(state.config.terrain).toBe('treacherous');
  });

  it('does not create shield pieces', () => {
    const state = createInitialState(['Player 1', 'Player 2'], null, undefined, 'calm');
    const shields = state.pieces.filter((p) => p.type === 'shield');
    expect(shields).toHaveLength(0);
  });
});
