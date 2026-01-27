import { createInitialState, getValidMoves } from '@jarls/shared';
import type { GameState, StarvationCandidates } from '@jarls/shared';
import { RandomAI } from '../random.js';

// Use zero delay for tests
function createTestAI(): RandomAI {
  return new RandomAI(0, 0);
}

function createTestState(): GameState {
  const state = createInitialState(['Alice', 'Bob']);
  // Ensure it's in playing phase with a current player
  return { ...state, phase: 'playing' as const };
}

describe('RandomAI', () => {
  describe('difficulty', () => {
    it('has difficulty set to random', () => {
      const ai = createTestAI();
      expect(ai.difficulty).toBe('random');
    });
  });

  describe('generateMove', () => {
    it('returns a valid move for the current player', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;

      const move = await ai.generateMove(state, playerId);

      expect(move).toHaveProperty('pieceId');
      expect(move).toHaveProperty('destination');
      expect(move.destination).toHaveProperty('q');
      expect(move.destination).toHaveProperty('r');

      // Verify the move is among the valid moves for that piece
      const validMoves = getValidMoves(state, move.pieceId);
      const isValid = validMoves.some(
        (vm) => vm.destination.q === move.destination.q && vm.destination.r === move.destination.r
      );
      expect(isValid).toBe(true);
    });

    it('returns a move belonging to the specified player', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;

      const move = await ai.generateMove(state, playerId);

      const piece = state.pieces.find((p) => p.id === move.pieceId);
      expect(piece).toBeDefined();
      expect(piece!.playerId).toBe(playerId);
    });

    it('throws when no valid moves are available', async () => {
      const ai = createTestAI();
      const state = createTestState();
      // Use a non-existent player ID so no pieces match
      await expect(ai.generateMove(state, 'nonexistent')).rejects.toThrow(
        'no valid moves available'
      );
    });

    it('produces different moves over multiple calls (non-deterministic)', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;

      const moves = new Set<string>();
      // Run enough times to likely see variation
      for (let i = 0; i < 20; i++) {
        const move = await ai.generateMove(state, playerId);
        moves.add(`${move.pieceId}:${move.destination.q},${move.destination.r}`);
      }

      // With a fresh board there should be multiple valid moves,
      // so we expect at least 2 different moves out of 20 tries
      expect(moves.size).toBeGreaterThan(1);
    });
  });

  describe('makeStarvationChoice', () => {
    it('returns a valid starvation choice', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;

      // Build fake candidates from the player's warriors
      const warriors = state.pieces.filter((p) => p.playerId === playerId && p.type === 'warrior');
      const candidates: StarvationCandidates = [
        {
          playerId,
          candidates: warriors,
          maxDistance: 3,
        },
      ];

      const choice = await ai.makeStarvationChoice(candidates, playerId);

      expect(choice.playerId).toBe(playerId);
      expect(warriors.some((w) => w.id === choice.pieceId)).toBe(true);
    });

    it('throws when no candidates exist for the player', async () => {
      const ai = createTestAI();
      const candidates: StarvationCandidates = [];

      await expect(ai.makeStarvationChoice(candidates, 'somePlayer')).rejects.toThrow(
        'no starvation candidates'
      );
    });
  });
});
