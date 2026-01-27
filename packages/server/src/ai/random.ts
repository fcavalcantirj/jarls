import type { GameState, MoveCommand, StarvationCandidates, StarvationChoice } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { AIPlayer } from './types.js';

/**
 * AI player that selects moves and starvation choices completely at random.
 */
export class RandomAI implements AIPlayer {
  readonly difficulty = 'random' as const;

  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(minDelayMs = 500, maxDelayMs = 1500) {
    this.minDelayMs = minDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    await this.thinkingDelay();

    // Collect all valid moves for all of this player's pieces
    const allMoves: { pieceId: string; destination: MoveCommand['destination'] }[] = [];

    for (const piece of state.pieces) {
      if (piece.playerId !== playerId) continue;
      const validMoves = getValidMoves(state, piece.id);
      for (const move of validMoves) {
        allMoves.push({ pieceId: piece.id, destination: move.destination });
      }
    }

    if (allMoves.length === 0) {
      throw new Error(`RandomAI: no valid moves available for player ${playerId}`);
    }

    const chosen = allMoves[Math.floor(Math.random() * allMoves.length)];
    return { pieceId: chosen.pieceId, destination: chosen.destination };
  }

  async makeStarvationChoice(
    candidates: StarvationCandidates,
    playerId: string
  ): Promise<StarvationChoice> {
    await this.thinkingDelay();

    const playerCandidates = candidates.find((c) => c.playerId === playerId);
    if (!playerCandidates || playerCandidates.candidates.length === 0) {
      throw new Error(`RandomAI: no starvation candidates for player ${playerId}`);
    }

    const chosen =
      playerCandidates.candidates[Math.floor(Math.random() * playerCandidates.candidates.length)];

    return { playerId, pieceId: chosen.id };
  }

  private thinkingDelay(): Promise<void> {
    const delay = this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
