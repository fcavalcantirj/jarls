import type { GameState, MoveCommand, StarvationCandidates, StarvationChoice } from '@jarls/shared';

/** AI difficulty levels */
export type AIDifficulty = 'random' | 'heuristic';

/** Interface that all AI player implementations must satisfy */
export interface AIPlayer {
  /** The difficulty level of this AI */
  readonly difficulty: AIDifficulty;

  /** Generate a move for the given player in the current game state */
  generateMove(state: GameState, playerId: string): Promise<MoveCommand>;

  /** Choose which warrior to sacrifice during starvation */
  makeStarvationChoice(
    candidates: StarvationCandidates,
    playerId: string
  ): Promise<StarvationChoice>;
}
