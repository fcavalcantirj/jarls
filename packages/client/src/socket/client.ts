import { io, Socket } from 'socket.io-client';
import type {
  GameState,
  GameEvent,
  ValidMove,
  MoveCommand,
  StarvationCandidates,
} from '@jarls/shared';

// ── Event types (mirroring server socket types) ──────────────────────────

export interface ClientToServerEvents {
  joinGame: (
    payload: { gameId: string; sessionToken: string },
    callback: (response: JoinGameResponse) => void
  ) => void;
  playTurn: (
    payload: { gameId: string; command: MoveCommand },
    callback: (response: PlayTurnResponse) => void
  ) => void;
  startGame: (payload: { gameId: string }, callback: (response: StartGameResponse) => void) => void;
  starvationChoice: (
    payload: { gameId: string; pieceId: string },
    callback: (response: StarvationChoiceResponse) => void
  ) => void;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  turnPlayed: (data: {
    newState: GameState;
    events: GameEvent[];
    validMoves?: ValidMove[];
  }) => void;
  gameEnded: (data: {
    winnerId: string;
    winCondition: 'throne' | 'lastStanding';
    finalState: GameState;
  }) => void;
  playerJoined: (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  playerLeft: (data: { playerId: string; gameState: GameState }) => void;
  playerReconnected: (data: { playerId: string; playerName: string; gameState: GameState }) => void;
  starvationRequired: (data: { candidates: StarvationCandidates; timeoutMs: number }) => void;
  error: (data: { code: string; message: string }) => void;
}

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

// ── Typed socket ─────────────────────────────────────────────────────────

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ── Socket instance (singleton) ──────────────────────────────────────────

let socket: GameSocket | null = null;

/**
 * Get or create the socket instance. Does NOT connect automatically.
 */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as GameSocket;
  }
  return socket;
}

/**
 * Connect the socket with the given session token for auth.
 */
export function connect(sessionToken: string): GameSocket {
  const s = getSocket();
  s.auth = { token: sessionToken };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Disconnect the socket and clean up.
 */
export function disconnect(): void {
  if (socket) {
    socket.disconnect();
  }
}
