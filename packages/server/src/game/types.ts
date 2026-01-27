import type { GameConfig, GameState, MoveCommand, StarvationChoice } from '@jarls/shared';

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

// ============================================================================
// Game Machine Event Types
// ============================================================================

/** Event: A player joined the game lobby */
export interface PlayerJoinedMachineEvent {
  type: 'PLAYER_JOINED';
  playerId: string;
  playerName: string;
}

/** Event: A player left the game */
export interface PlayerLeftMachineEvent {
  type: 'PLAYER_LEFT';
  playerId: string;
}

/** Event: The host requested the game to start */
export interface StartGameMachineEvent {
  type: 'START_GAME';
  playerId: string;
}

/** Event: A player submitted a move */
export interface MakeMoveMachineEvent {
  type: 'MAKE_MOVE';
  playerId: string;
  command: MoveCommand;
}

/** Event: A player submitted their starvation choice */
export interface StarvationChoiceMachineEvent {
  type: 'STARVATION_CHOICE';
  playerId: string;
  pieceId: string;
}

/** Event: A timer expired (turn timer or starvation timer) */
export interface TimeoutMachineEvent {
  type: 'TIMEOUT';
}

/** Event: A player disconnected from the game */
export interface PlayerDisconnectedMachineEvent {
  type: 'PLAYER_DISCONNECTED';
  playerId: string;
}

/** Event: A previously disconnected player reconnected */
export interface PlayerReconnectedMachineEvent {
  type: 'PLAYER_RECONNECTED';
  playerId: string;
}

/** Union type of all events the game machine can receive */
export type GameMachineEvent =
  | PlayerJoinedMachineEvent
  | PlayerLeftMachineEvent
  | StartGameMachineEvent
  | MakeMoveMachineEvent
  | StarvationChoiceMachineEvent
  | TimeoutMachineEvent
  | PlayerDisconnectedMachineEvent
  | PlayerReconnectedMachineEvent;
