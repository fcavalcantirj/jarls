import type { GameConfig, GameState, StarvationChoice } from '@jarls/shared';

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

/**
 * Game machine context - extends the shared GameState with server-side
 * properties needed for the XState state machine.
 */
export interface GameMachineContext extends GameState {
  /** Turn timer duration in ms, or null if no timer is configured */
  turnTimerMs: number | null;
  /** Set of player IDs that are currently disconnected */
  disconnectedPlayers: Set<string>;
  /** Starvation choices collected from players during a starvation phase */
  starvationChoices: StarvationChoice[];
}
