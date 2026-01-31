import { createInitialState, getValidMoves } from '@jarls/shared';
import type { GameState } from '@jarls/shared';
import { HeuristicAI } from '../heuristic-ai.js';

// Use zero delay for tests
function createTestAI(): HeuristicAI {
  return new HeuristicAI(0, 0);
}

function createTestState(): GameState {
  const state = createInitialState(['Alice', 'Bob']);
  return { ...state, phase: 'playing' as const };
}

describe('HeuristicAI', () => {
  describe('difficulty', () => {
    it('has difficulty set to heuristic', () => {
      const ai = createTestAI();
      expect(ai.difficulty).toBe('heuristic');
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
      await expect(ai.generateMove(state, 'nonexistent')).rejects.toThrow(
        'no valid moves available'
      );
    });

    it('prefers winning moves (Jarl to throne)', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;

      // Place the player's Jarl adjacent to the throne (0,0)
      const jarl = state.pieces.find((p) => p.playerId === playerId && p.type === 'jarl');
      expect(jarl).toBeDefined();

      // Put Jarl at (1,0), one step from throne at (0,0)
      const modifiedState: GameState = {
        ...state,
        pieces: state.pieces.map((p) => {
          if (p.id === jarl!.id) {
            return { ...p, position: { q: 1, r: 0 } };
          }
          // Remove any piece that might be at (1,0) or (0,0) (except shields at throne)
          if (
            p.id !== jarl!.id &&
            ((p.position.q === 1 && p.position.r === 0) ||
              (p.position.q === 0 && p.position.r === 0))
          ) {
            // Move them out of the way
            return { ...p, position: { q: -3, r: 0 } };
          }
          return p;
        }),
      };

      // Run multiple times - the winning move should always be chosen
      let throneChosen = 0;
      const runs = 10;
      for (let i = 0; i < runs; i++) {
        const move = await ai.generateMove(modifiedState, playerId);
        if (move.destination.q === 0 && move.destination.r === 0) {
          throneChosen++;
        }
      }

      // The throne move scores +100, so it should be chosen nearly every time
      expect(throneChosen).toBeGreaterThanOrEqual(runs - 1);
    });

    it('avoids putting Jarl on edge', async () => {
      const ai = createTestAI();
      const state = createTestState();
      const playerId = state.players[0].id;
      const boardRadius = state.config.boardRadius;

      // Place Jarl one step from edge, with options to move toward center or edge
      // Jarl at (2,0) in a radius-3 board: edge is at distance 3
      const jarl = state.pieces.find((p) => p.playerId === playerId && p.type === 'jarl');
      expect(jarl).toBeDefined();

      // Clear the area so Jarl has moves toward both center and edge
      const modifiedState: GameState = {
        ...state,
        pieces: state.pieces.map((p) => {
          if (p.id === jarl!.id) {
            return { ...p, position: { q: 2, r: 0 } };
          }
          // Remove nearby pieces that could block moves
          const dist =
            Math.abs(p.position.q - 2) +
            Math.abs(p.position.r) +
            Math.abs(-p.position.q - p.position.r + 2);
          if (p.id !== jarl!.id && dist / 2 <= 2 && p.type !== 'shield') {
            return { ...p, position: { q: -3, r: 3 } };
          }
          return p;
        }),
      };

      // Run multiple times and count how often the Jarl moves to the edge
      let edgeMoves = 0;
      let centerMoves = 0;
      const runs = 20;
      for (let i = 0; i < runs; i++) {
        const move = await ai.generateMove(modifiedState, playerId);
        const piece = modifiedState.pieces.find((p) => p.id === move.pieceId);
        if (piece?.type === 'jarl') {
          const absQ = Math.abs(move.destination.q);
          const absR = Math.abs(move.destination.r);
          const absS = Math.abs(-move.destination.q - move.destination.r);
          const dist = Math.max(absQ, absR, absS);
          if (dist >= boardRadius) {
            edgeMoves++;
          } else {
            centerMoves++;
          }
        }
      }

      // The AI should prefer moves toward center over edge
      // With -30 penalty for Jarl on edge, center moves should dominate
      expect(centerMoves).toBeGreaterThan(edgeMoves);
    });
  });
});
