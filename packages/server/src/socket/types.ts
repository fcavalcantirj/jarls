import type {
  GameState,
  GameEvent,
  MoveCommand,
  ValidMove,
  AIConfig,
  GroqModel,
  GroqDifficulty,
} from '@jarls/shared';

// ── Client → Server Events ──────────────────────────────────────────────

export interface JoinGamePayload {
  gameId: string;
  sessionToken: string;
}

export interface PlayTurnPayload {
  gameId: string;
  command: MoveCommand;
  /** Optional turn number for stale request detection */
  turnNumber?: number;
}

export interface StartGamePayload {
  gameId: string;
}

export interface UpdateAIConfigPayload {
  gameId: string;
  config: {
    model?: GroqModel;
    difficulty?: GroqDifficulty;
    customPrompt?: string;
  };
}

export interface ClientToServerEvents {
  joinGame: (payload: JoinGamePayload, callback: (response: JoinGameResponse) => void) => void;

  playTurn: (payload: PlayTurnPayload, callback: (response: PlayTurnResponse) => void) => void;

  startGame: (payload: StartGamePayload, callback: (response: StartGameResponse) => void) => void;

  updateAIConfig: (
    payload: UpdateAIConfigPayload,
    callback: (response: UpdateAIConfigResponse) => void
  ) => void;
}

// ── Server → Client Events ──────────────────────────────────────────────

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;

  turnPlayed: (data: TurnPlayedData) => void;

  gameEnded: (data: GameEndedData) => void;

  playerJoined: (data: PlayerJoinedData) => void;

  playerLeft: (data: PlayerLeftData) => void;

  playerReconnected: (data: PlayerReconnectedData) => void;

  aiConfigUpdated: (data: AIConfigUpdatedData) => void;

  error: (data: SocketErrorData) => void;
}

// ── Server → Client Payloads ────────────────────────────────────────────

export interface TurnPlayedData {
  newState: GameState;
  events: GameEvent[];
  validMoves?: ValidMove[];
}

export interface GameEndedData {
  winnerId: string;
  winCondition: 'throne' | 'lastStanding';
  finalState: GameState;
}

export interface PlayerJoinedData {
  playerId: string;
  playerName: string;
  gameState: GameState;
}

export interface PlayerLeftData {
  playerId: string;
  gameState: GameState;
}

export interface PlayerReconnectedData {
  playerId: string;
  playerName: string;
  gameState: GameState;
}

export interface AIConfigUpdatedData {
  config: AIConfig;
}

export interface SocketErrorData {
  code: string;
  message: string;
}

// ── Callback Response Types ─────────────────────────────────────────────

export interface JoinGameResponse {
  success: boolean;
  error?: string;
  gameState?: GameState;
  playerId?: string;
}

export interface PlayTurnResponse {
  success: boolean;
  error?: string;
}

export interface StartGameResponse {
  success: boolean;
  error?: string;
}

export interface UpdateAIConfigResponse {
  success: boolean;
  error?: string;
  config?: AIConfig;
}

// ── Socket Data (attached to socket instance) ───────────────────────────

export interface SocketData {
  gameId?: string;
  playerId?: string;
  playerName?: string;
  sessionToken?: string;
}

// ── Inter-Server Events (for scalability) ───────────────────────────────

export interface InterServerEvents {
  ping: () => void;
}
