import type { GameState, MoveCommand } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { AIPlayer } from './types.js';
import { scoreMove } from './heuristic.js';

interface ScoredMove {
  pieceId: string;
  destination: MoveCommand['destination'];
  score: number;
}

/**
 * AI player that scores all available moves using heuristics
 * and picks from the top candidates with weighted random selection.
 */
export class HeuristicAI implements AIPlayer {
  readonly difficulty = 'heuristic' as const;

  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly topN: number;

  constructor(minDelayMs = 500, maxDelayMs = 1500, topN = 3) {
    this.minDelayMs = minDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.topN = topN;
  }

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    await this.thinkingDelay();

    // Collect and score all valid moves
    const scoredMoves: ScoredMove[] = [];

    for (const piece of state.pieces) {
      if (piece.playerId !== playerId) continue;
      const validMoves = getValidMoves(state, piece.id);
      for (const move of validMoves) {
        const score = scoreMove(state, move, piece.id, playerId);
        scoredMoves.push({
          pieceId: piece.id,
          destination: move.destination,
          score,
        });
      }
    }

    if (scoredMoves.length === 0) {
      throw new Error(`HeuristicAI: no valid moves available for player ${playerId}`);
    }

    // Sort descending by score
    scoredMoves.sort((a, b) => b.score - a.score);

    // Take top N candidates
    const candidates = scoredMoves.slice(0, this.topN);

    // Weighted random selection among top candidates
    // Shift scores so the minimum is at least 1 (to ensure all have positive weight)
    const minScore = Math.min(...candidates.map((c) => c.score));
    const shift = minScore < 1 ? 1 - minScore : 0;
    const weights = candidates.map((c) => c.score + shift);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    let roll = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return { pieceId: candidates[i].pieceId, destination: candidates[i].destination };
      }
    }

    // Fallback to best move (shouldn't reach here)
    return { pieceId: candidates[0].pieceId, destination: candidates[0].destination };
  }

  private thinkingDelay(): Promise<void> {
    const delay = this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
