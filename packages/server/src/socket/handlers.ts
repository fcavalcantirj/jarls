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
  PlayTurnPayload,
  PlayTurnResponse,
  StarvationChoicePayload,
  StarvationChoiceResponse,
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
    console.log(`Socket connected: ${socket.id} (recovered: ${socket.recovered})`);

    // Handle connection state recovery (Socket.IO automatic reconnect)
    handleConnectionRecovery(socket, gameManager);

    handleJoinGame(socket, gameManager);
    handleStartGame(socket, io, gameManager);
    handlePlayTurn(socket, io, gameManager);
    handleStarvationChoice(socket, io, gameManager);
    handleDisconnect(socket, io, gameManager);
  });
}

// ── Connection Recovery Handler ──────────────────────────────────────────

/**
 * Handle Socket.IO connection state recovery. When a client reconnects
 * within the recovery window (2 minutes), Socket.IO restores the socket's
 * rooms and data. We detect this and notify the game manager to unpause
 * the game, then emit the current game state to the reconnected player.
 */
function handleConnectionRecovery(socket: TypedSocket, gameManager: GameManager): void {
  if (!socket.recovered) return;

  const { gameId, playerId, playerName } = socket.data;
  if (!gameId || !playerId) return;

  try {
    // Notify the game manager about the reconnection (may unpause the game)
    gameManager.onReconnect(gameId, playerId);

    // Get the current game state and send it to the reconnected player
    const snapshot = gameManager.getState(gameId);
    if (snapshot) {
      const context = snapshot.context as GameMachineContext;

      // Send current state to the reconnected player
      socket.emit('gameState', context);

      // Notify other players about the reconnection
      socket.to(gameId).emit('playerReconnected', {
        playerId,
        playerName: playerName ?? 'Unknown',
        gameState: context,
      });
    }

    console.log(`Player ${playerName} (${playerId}) recovered connection to game ${gameId}`);
  } catch (err) {
    // Recovery is best-effort; don't crash on errors
    // (e.g., game may have ended during disconnection, or player wasn't actually disconnected)
    console.error(`Error handling connection recovery for player ${playerId}:`, err);
  }
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

        // Check if this player was disconnected and needs to be reconnected
        const context = snapshot.context as GameMachineContext;
        if (context.disconnectedPlayers?.has(session.playerId)) {
          gameManager.onReconnect(gameId, session.playerId);
          // Re-fetch state after reconnection (may have transitioned from paused to playing)
          const updatedSnapshot = gameManager.getState(gameId);
          const updatedContext = (updatedSnapshot?.context ?? context) as GameMachineContext;

          socket.to(gameId).emit('playerReconnected', {
            playerId: session.playerId,
            playerName: session.playerName,
            gameState: updatedContext,
          });

          callback({
            success: true,
            gameState: updatedContext,
            playerId: session.playerId,
          });
        } else {
          // Normal join - notify other players
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
        }

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
  socket.on(
    'startGame',
    async (payload: StartGamePayload, callback: (r: StartGameResponse) => void) => {
      try {
        const { gameId } = payload;
        const { playerId, sessionToken } = socket.data;

        if (!playerId || !socket.data.gameId) {
          callback({ success: false, error: 'Not joined to a game. Call joinGame first.' });
          return;
        }

        if (socket.data.gameId !== gameId) {
          callback({ success: false, error: 'Game ID mismatch' });
          return;
        }

        // Re-validate session to catch expired sessions
        if (sessionToken) {
          const session = await validateSession(sessionToken);
          if (!session) {
            callback({ success: false, error: 'Session expired. Please rejoin.' });
            return;
          }
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
    }
  );
}

// ── playTurn Handler ────────────────────────────────────────────────────

function handlePlayTurn(socket: TypedSocket, io: TypedServer, gameManager: GameManager): void {
  socket.on(
    'playTurn',
    async (payload: PlayTurnPayload, callback: (r: PlayTurnResponse) => void) => {
      try {
        const { gameId, command, turnNumber } = payload;
        const { playerId, sessionToken } = socket.data;

        // DEBUG
        console.log(
          `[SOCKET playTurn] player=${playerId} turnNumber=${turnNumber} piece=${command.pieceId}`
        );

        if (!playerId || !socket.data.gameId) {
          callback({ success: false, error: 'Not joined to a game. Call joinGame first.' });
          return;
        }

        if (socket.data.gameId !== gameId) {
          callback({ success: false, error: 'Game ID mismatch' });
          return;
        }

        // Re-validate session to catch expired sessions
        if (sessionToken) {
          const session = await validateSession(sessionToken);
          if (!session) {
            callback({ success: false, error: 'Session expired. Please rejoin.' });
            return;
          }
        }

        // Execute the move via GameManager (now async with mutex lock)
        const result = await gameManager.makeMove(gameId, playerId, command, turnNumber);

        console.log(
          `[SOCKET playTurn] result success=${result.success} error=${result.error ?? 'none'} events=${result.events?.length ?? 0}`
        );

        if (!result.success) {
          console.log(`[SOCKET playTurn] REJECTED: ${result.error}`);
          callback({ success: false, error: result.error ?? 'Invalid move' });
          return;
        }

        // Log the new state being broadcast
        const movedPiece = result.newState.pieces.find((p) => p.id === command.pieceId);
        console.log(
          `[SOCKET turnPlayed] broadcasting newState turn=${result.newState.turnNumber} currentPlayer=${result.newState.currentPlayerId} movedPiece=${command.pieceId} at (${movedPiece?.position.q},${movedPiece?.position.r})`
        );

        // Broadcast the turn result to all players in the room
        io.to(gameId).emit('turnPlayed', {
          newState: result.newState,
          events: result.events,
        });

        // Check if the game ended
        const gameEndedEvent = result.events.find((e) => e.type === 'GAME_ENDED');
        if (gameEndedEvent && gameEndedEvent.type === 'GAME_ENDED') {
          io.to(gameId).emit('gameEnded', {
            winnerId: gameEndedEvent.winnerId,
            winCondition: gameEndedEvent.winCondition,
            finalState: result.newState,
          });
        }

        // Check if starvation was triggered after the move
        checkAndBroadcastStarvation(io, gameManager, gameId);

        callback({ success: true });

        console.log(`Player ${playerId} played turn in game ${gameId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to play turn';
        callback({ success: false, error: message });
      }
    }
  );
}

// ── starvationChoice Handler ────────────────────────────────────────────

function handleStarvationChoice(
  socket: TypedSocket,
  io: TypedServer,
  gameManager: GameManager
): void {
  socket.on(
    'starvationChoice',
    async (payload: StarvationChoicePayload, callback: (r: StarvationChoiceResponse) => void) => {
      try {
        const { gameId, pieceId } = payload;
        const { playerId, sessionToken } = socket.data;

        if (!playerId || !socket.data.gameId) {
          callback({ success: false, error: 'Not joined to a game. Call joinGame first.' });
          return;
        }

        if (socket.data.gameId !== gameId) {
          callback({ success: false, error: 'Game ID mismatch' });
          return;
        }

        // Re-validate session to catch expired sessions
        if (sessionToken) {
          const session = await validateSession(sessionToken);
          if (!session) {
            callback({ success: false, error: 'Session expired. Please rejoin.' });
            return;
          }
        }

        // Submit the starvation choice via GameManager
        gameManager.submitStarvationChoice(gameId, playerId, pieceId);

        callback({ success: true });

        console.log(`Player ${playerId} submitted starvation choice in game ${gameId}`);

        // After submitting, check if starvation resolved (all choices made).
        // The state machine may have transitioned back to playing or ended.
        const snapshot = gameManager.getState(gameId);
        if (!snapshot) return;

        const stateValue = snapshot.value;
        const postStateName =
          typeof stateValue === 'string' ? stateValue : Object.keys(stateValue)[0];
        const context = snapshot.context as GameMachineContext;

        if (postStateName === 'ended' && context.winnerId) {
          io.to(gameId).emit('gameEnded', {
            winnerId: context.winnerId,
            winCondition: context.winCondition as 'throne' | 'lastStanding',
            finalState: context,
          });
        } else if (postStateName === 'playing') {
          // Starvation resolved, game continues - broadcast updated state
          io.to(gameId).emit('gameState', context);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit starvation choice';
        callback({ success: false, error: message });
      }
    }
  );
}

// ── Starvation Detection Helper ─────────────────────────────────────────

/**
 * Check if the game has transitioned to starvation state after a move,
 * and broadcast starvationRequired to all players in the room.
 */
function checkAndBroadcastStarvation(
  io: TypedServer,
  gameManager: GameManager,
  gameId: string
): void {
  const snapshot = gameManager.getState(gameId);
  if (!snapshot) return;

  // Check the actual machine state, not context.phase (which may not be updated)
  const stateValue = snapshot.value;
  const stateName = typeof stateValue === 'string' ? stateValue : Object.keys(stateValue)[0];
  if (stateName !== 'starvation') return;

  const context = snapshot.context as GameMachineContext;

  // Starvation was triggered - broadcast candidates to all players
  io.to(gameId).emit('starvationRequired', {
    candidates: context.starvationCandidates,
    timeoutMs: context.turnTimerMs ?? 30_000,
  });

  console.log(`Starvation triggered in game ${gameId}`);
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
