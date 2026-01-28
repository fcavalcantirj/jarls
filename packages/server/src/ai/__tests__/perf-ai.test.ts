import { createInitialState } from '@jarls/shared';
import type { GameState } from '@jarls/shared';
import { RandomAI } from '../random.js';
import { HeuristicAI } from '../heuristic-ai.js';

function createPlayingState(): GameState {
  const state = createInitialState(['Alice', 'Bob']);
  return { ...state, phase: 'playing' as const };
}

describe('Performance: AI move generation', () => {
  describe('RandomAI', () => {
    it('should generate a move in under 2 seconds (excluding thinking delay)', async () => {
      // Use zero delay so we measure only computation time
      const ai = new RandomAI(0, 0);
      const state = createPlayingState();
      const playerId = state.players[0].id;

      const start = Date.now();
      await ai.generateMove(state, playerId);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('HeuristicAI', () => {
    it('should generate a move in under 2 seconds (excluding thinking delay)', async () => {
      // Use zero delay so we measure only computation time
      const ai = new HeuristicAI(0, 0);
      const state = createPlayingState();
      const playerId = state.players[0].id;

      const start = Date.now();
      await ai.generateMove(state, playerId);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000);
    });

    it('should generate moves consistently under 2 seconds across multiple calls', async () => {
      const ai = new HeuristicAI(0, 0);
      const state = createPlayingState();
      const playerId = state.players[0].id;

      const iterations = 10;
      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        await ai.generateMove(state, playerId);
      }
      const totalElapsed = Date.now() - start;
      const avgElapsed = totalElapsed / iterations;

      expect(avgElapsed).toBeLessThan(2000);
    });
  });
});
