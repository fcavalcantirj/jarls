import { calculateStarvationCandidates, createInitialState } from '../index';

describe('calculateStarvationCandidates', () => {
  describe('single warrior per player', () => {
    it('should return the single warrior as candidate for each player', () => {
      const state = createInitialState(['A', 'B']);
      state.phase = 'playing';
      const p1 = state.players[0];
      const p2 = state.players[1];

      // Replace warriors: one per player at known positions
      const jarls = state.pieces.filter((p) => p.type === 'jarl');
      const shields = state.pieces.filter((p) => p.type === 'shield');
      state.pieces = [
        ...jarls,
        ...shields,
        { id: 'w1', type: 'warrior', playerId: p1.id, position: { q: 2, r: -1 } },
        { id: 'w2', type: 'warrior', playerId: p2.id, position: { q: -1, r: 2 } },
      ];

      const result = calculateStarvationCandidates(state);

      // Each player should have exactly 1 candidate
      const p1Result = result.find((r) => r.playerId === p1.id);
      const p2Result = result.find((r) => r.playerId === p2.id);
      expect(p1Result).toBeDefined();
      expect(p2Result).toBeDefined();
      expect(p1Result!.candidates).toHaveLength(1);
      expect(p2Result!.candidates).toHaveLength(1);
      expect(p1Result!.candidates[0].id).toBe('w1');
      expect(p2Result!.candidates[0].id).toBe('w2');
    });
  });

  describe('multiple warriors, clear furthest', () => {
    it('should return only the warrior furthest from throne', () => {
      const state = createInitialState(['A', 'B']);
      state.phase = 'playing';
      const p1 = state.players[0];

      // Place warriors at different distances from throne (0,0)
      const jarls = state.pieces.filter((p) => p.type === 'jarl');
      const shields = state.pieces.filter((p) => p.type === 'shield');
      // Keep p2 warriors from initial state, replace p1 warriors
      const p2Warriors = state.pieces.filter(
        (p) => p.type === 'warrior' && p.playerId === state.players[1].id
      );
      state.pieces = [
        ...jarls,
        ...shields,
        ...p2Warriors,
        // p1 warriors at distances 1, 2, 3 from throne
        { id: 'w-close', type: 'warrior', playerId: p1.id, position: { q: 1, r: 0 } }, // distance 1
        { id: 'w-mid', type: 'warrior', playerId: p1.id, position: { q: 2, r: 0 } }, // distance 2
        { id: 'w-far', type: 'warrior', playerId: p1.id, position: { q: 3, r: 0 } }, // distance 3
      ];

      const result = calculateStarvationCandidates(state);
      const p1Result = result.find((r) => r.playerId === p1.id);

      expect(p1Result).toBeDefined();
      expect(p1Result!.maxDistance).toBe(3);
      expect(p1Result!.candidates).toHaveLength(1);
      expect(p1Result!.candidates[0].id).toBe('w-far');
    });
  });

  describe('tie scenario with equidistant warriors', () => {
    it('should return all warriors at max distance when tied', () => {
      const state = createInitialState(['A', 'B']);
      state.phase = 'playing';
      const p1 = state.players[0];

      const jarls = state.pieces.filter((p) => p.type === 'jarl');
      const shields = state.pieces.filter((p) => p.type === 'shield');
      const p2Warriors = state.pieces.filter(
        (p) => p.type === 'warrior' && p.playerId === state.players[1].id
      );
      state.pieces = [
        ...jarls,
        ...shields,
        ...p2Warriors,
        // p1: two warriors at distance 3, one at distance 1
        { id: 'w-close', type: 'warrior', playerId: p1.id, position: { q: 1, r: 0 } }, // distance 1
        { id: 'w-far-a', type: 'warrior', playerId: p1.id, position: { q: 3, r: 0 } }, // distance 3
        { id: 'w-far-b', type: 'warrior', playerId: p1.id, position: { q: 0, r: 3 } }, // distance 3
      ];

      const result = calculateStarvationCandidates(state);
      const p1Result = result.find((r) => r.playerId === p1.id);

      expect(p1Result).toBeDefined();
      expect(p1Result!.maxDistance).toBe(3);
      expect(p1Result!.candidates).toHaveLength(2);
      const candidateIds = p1Result!.candidates.map((c) => c.id).sort();
      expect(candidateIds).toEqual(['w-far-a', 'w-far-b']);
    });
  });

  describe('player with no warriors', () => {
    it('should return empty candidates for player with no warriors', () => {
      const state = createInitialState(['A', 'B']);
      state.phase = 'playing';
      const p1 = state.players[0];

      // Remove all p1 warriors
      state.pieces = state.pieces.filter((p) => !(p.type === 'warrior' && p.playerId === p1.id));

      const result = calculateStarvationCandidates(state);
      const p1Result = result.find((r) => r.playerId === p1.id);

      expect(p1Result).toBeDefined();
      expect(p1Result!.candidates).toHaveLength(0);
      expect(p1Result!.maxDistance).toBe(0);
    });
  });

  describe('eliminated players are excluded', () => {
    it('should not include eliminated players in results', () => {
      const state = createInitialState(['A', 'B']);
      state.phase = 'playing';

      // Eliminate player 1
      state.players[0].isEliminated = true;

      const result = calculateStarvationCandidates(state);

      // Only player 2 should be in results
      expect(result).toHaveLength(1);
      expect(result[0].playerId).toBe(state.players[1].id);
    });
  });
});
