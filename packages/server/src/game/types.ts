import type { GameConfig } from '@jarls/shared';

/**
 * Input required to create a game machine actor.
 * This is the data needed to initialize a new game instance.
 */
export interface GameMachineInput {
  /** Unique identifier for this game */
  gameId: string;
  /** Game configuration (board size, piece counts, timer settings) */
  config: GameConfig;
}
