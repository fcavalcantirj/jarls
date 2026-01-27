import { checkStarvationTrigger, createInitialState } from '../index';
import type { GameState } from '../index';

function makeState(roundsSinceElimination: number): GameState {
  const state = createInitialState(['A', 'B']);
  state.roundsSinceElimination = roundsSinceElimination;
  return state;
}

describe('checkStarvationTrigger', () => {
  describe('no trigger before 10 rounds', () => {
    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('should not trigger at %i rounds', (rounds) => {
      const state = makeState(rounds);
      const result = checkStarvationTrigger(state);
      expect(result.triggered).toBe(false);
    });
  });

  describe('initial trigger at 10 rounds', () => {
    it('should trigger at exactly 10 rounds', () => {
      const state = makeState(10);
      const result = checkStarvationTrigger(state);
      expect(result.triggered).toBe(true);
      expect(result.isInitial).toBe(true);
    });
  });

  describe('recurring triggers every 5 rounds after 10', () => {
    it.each([15, 20, 25, 30, 35, 40])('should trigger at %i rounds', (rounds) => {
      const state = makeState(rounds);
      const result = checkStarvationTrigger(state);
      expect(result.triggered).toBe(true);
      expect(result.isInitial).toBe(false);
    });
  });

  describe('no trigger between recurring intervals', () => {
    it.each([11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24])(
      'should not trigger at %i rounds',
      (rounds) => {
        const state = makeState(rounds);
        const result = checkStarvationTrigger(state);
        expect(result.triggered).toBe(false);
      }
    );
  });
});
