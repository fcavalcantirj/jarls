import type { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  JoinGamePayload,
  JoinGameResponse,
  StartGamePayload,
  StartGameResponse,
} from './types.js';
import type { GameManager } from '../game/manager.js';
import type { GameMachineContext } from '../game/types.js';
import { validateSession, extendSession } from '../services/session.js';

type TypedServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Register all Socket.IO connection and event handlers.
 * This is the main entry point for wiring up the real-time layer.
 */
export function registerSocketHandlers(io: TypedServer, gameManager: GameManager): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Socket connected: ${socket.id}`);

    handleJoinGame(socket, gameManager);
    handleStartGame(socket, io, gameManager);
    handleDisconnect(socket, io, gameManager);
  });
}

// ── joinGame Handler ────────────────────────────────────────────────────

function handleJoinGame(socket: TypedSocket, gameManager: GameManager): void {
  socket.on(
    'joinGame',
    async (payload: JoinGamePayload, callback: (r: JoinGameResponse) => void) => {
      try {
        const { gameId, sessionToken } = payload;

        // Validate the session token via Redis
        const session = await validateSession(sessionToken);
        if (!session) {
          callback({ success: false, error: 'Invalid or expired session token' });
          return;
        }

        if (session.gameId !== gameId) {
          callback({ success: false, error: 'Session does not match this game' });
          return;
        }

        // Verify the game exists
        const snapshot = gameManager.getState(gameId);
        if (!snapshot) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        // Store session data on the socket for future events
        socket.data.gameId = gameId;
        socket.data.playerId = session.playerId;
        socket.data.playerName = session.playerName;
        socket.data.sessionToken = sessionToken;

        // Join the Socket.IO room for this game
        await socket.join(gameId);

        // Extend session TTL on activity
        await extendSession(sessionToken);

        // Get current game state to send back
        const context = snapshot.context as GameMachineContext;

        // Notify other players in the room
        socket.to(gameId).emit('playerJoined', {
          playerId: session.playerId,
          playerName: session.playerName,
          gameState: context,
        });

        callback({
          success: true,
          gameState: context,
          playerId: session.playerId,
        });

        console.log(`Player ${session.playerName} (${session.playerId}) joined game ${gameId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join game';
        callback({ success: false, error: message });
      }
    }
  );
}

// ── startGame Handler ───────────────────────────────────────────────────

function handleStartGame(socket: TypedSocket, io: TypedServer, gameManager: GameManager): void {
  socket.on('startGame', (payload: StartGamePayload, callback: (r: StartGameResponse) => void) => {
    try {
      const { gameId } = payload;
      const { playerId } = socket.data;

      if (!playerId || !socket.data.gameId) {
        callback({ success: false, error: 'Not joined to a game. Call joinGame first.' });
        return;
      }

      if (socket.data.gameId !== gameId) {
        callback({ success: false, error: 'Game ID mismatch' });
        return;
      }

      // Delegate to GameManager (validates host, player count, state)
      gameManager.start(gameId, playerId);

      // Get the updated state after starting
      const snapshot = gameManager.getState(gameId);
      if (snapshot) {
        const context = snapshot.context as GameMachineContext;
        // Broadcast the new game state to all players in the room
        io.to(gameId).emit('gameState', context);
      }

      callback({ success: true });

      console.log(`Game ${gameId} started by player ${playerId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      callback({ success: false, error: message });
    }
  });
}

// ── disconnect Handler ──────────────────────────────────────────────────

function handleDisconnect(socket: TypedSocket, io: TypedServer, gameManager: GameManager): void {
  socket.on('disconnect', (reason) => {
    const { gameId, playerId, playerName } = socket.data;

    console.log(`Socket disconnected: ${socket.id} (reason: ${reason})`);

    if (!gameId || !playerId) return;

    try {
      // Notify the game manager about the disconnection
      gameManager.onDisconnect(gameId, playerId);

      // Get updated state and notify remaining players
      const snapshot = gameManager.getState(gameId);
      if (snapshot) {
        const context = snapshot.context as GameMachineContext;
        io.to(gameId).emit('playerLeft', {
          playerId,
          gameState: context,
        });
      }

      console.log(`Player ${playerName} (${playerId}) disconnected from game ${gameId}`);
    } catch (err) {
      // Disconnection handling is best-effort; don't crash on errors
      // (e.g., game may already be in 'ended' or 'lobby' state)
      console.error(`Error handling disconnect for player ${playerId}:`, err);
    }
  });
}
