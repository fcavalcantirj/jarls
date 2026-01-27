import type {
  GameState,
  GameEvent,
  MoveCommand,
  ValidMove,
  StarvationCandidates,
} from '@jarls/shared';

// ── Client → Server Events ──────────────────────────────────────────────

export interface JoinGamePayload {
  gameId: string;
  sessionToken: string;
}

export interface PlayTurnPayload {
  gameId: string;
  command: MoveCommand;
}

export interface StartGamePayload {
  gameId: string;
}

export interface StarvationChoicePayload {
  gameId: string;
  pieceId: string;
}

export interface ClientToServerEvents {
  joinGame: (payload: JoinGamePayload, callback: (response: JoinGameResponse) => void) => void;

  playTurn: (payload: PlayTurnPayload, callback: (response: PlayTurnResponse) => void) => void;

  startGame: (payload: StartGamePayload, callback: (response: StartGameResponse) => void) => void;

  starvationChoice: (
    payload: StarvationChoicePayload,
    callback: (response: StarvationChoiceResponse) => void
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

  starvationRequired: (data: StarvationRequiredData) => void;

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

export interface StarvationRequiredData {
  candidates: StarvationCandidates;
  timeoutMs: number;
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

export interface StarvationChoiceResponse {
  success: boolean;
  error?: string;
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
