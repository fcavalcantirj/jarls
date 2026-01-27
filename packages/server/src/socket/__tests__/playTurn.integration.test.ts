import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import http from 'http';
import express from 'express';
import { Pool, QueryResultRow } from 'pg';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import type { GameConfig, GameState } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinGameResponse,
  StartGameResponse,
  PlayTurnResponse,
  TurnPlayedData,
} from '../types.js';

// ── Test infrastructure ─────────────────────────────────────────────

const TEST_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://jarls:jarls@localhost:5432/jarls';
const TEST_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const testPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 3 });
const testRedis = new Redis(TEST_REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Mock db module to use test pool
jest.unstable_mockModule('../../db', () => ({
  query: async <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    return testPool.query<T>(text, params);
  },
}));

// Mock redis module to use test redis client
jest.unstable_mockModule('../../redis/client', () => ({
  redis: testRedis,
  closeRedis: async () => {
    await testRedis.quit();
  },
}));

// Dynamic imports after mocking
const { GameManager } = await import('../../game/manager');
const { registerSocketHandlers } = await import('../handlers');
const { createSession } = await import('../../services/session');

// ── Type for typed client socket ─────────────────────────────────────

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

// ── Test helpers ────────────────────────────────────────────────────

function createTestConfig(): GameConfig {
  return {
    playerCount: 2,
    boardRadius: 3,
    shieldCount: 5,
    warriorCount: 5,
    turnTimerMs: null,
  };
}

let httpServer: http.Server;
let io: SocketIOServer;
let manager: InstanceType<typeof GameManager>;
let serverPort: number;
const clientSockets: TypedClientSocket[] = [];

function createTestServer(): Promise<number> {
  return new Promise((resolve) => {
    const app = express();
    httpServer = http.createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    manager = new GameManager();
    registerSocketHandlers(io, manager);

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(port);
    });
  });
}

function createClientSocket(): TypedClientSocket {
  const socket = ioClient(`http://localhost:${serverPort}`, {
    autoConnect: false,
    transports: ['websocket'],
  }) as TypedClientSocket;
  clientSockets.push(socket);
  return socket;
}

function connectSocket(socket: TypedClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', (err) => reject(err));
    socket.connect();
  });
}

/** Helper: create a game, join two players, return their session tokens and IDs */
async function createGameWithTwoPlayers() {
  const gameId = await manager.create({ config: createTestConfig() });
  const p1Id = manager.join(gameId, 'Ragnar');
  const p2Id = manager.join(gameId, 'Lagertha');

  const token1 = await createSession(gameId, p1Id, 'Ragnar');
  const token2 = await createSession(gameId, p2Id, 'Lagertha');

  return {
    gameId,
    player1: { playerId: p1Id, token: token1 },
    player2: { playerId: p2Id, token: token2 },
  };
}

/** Helper: connect both players, join game via socket, and start the game */
async function setupStartedGame() {
  const { gameId, player1, player2 } = await createGameWithTwoPlayers();

  const socket1 = createClientSocket();
  await connectSocket(socket1);
  const joinResp1 = await new Promise<JoinGameResponse>((resolve) => {
    socket1.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
      resolve(r)
    );
  });
  expect(joinResp1.success).toBe(true);

  const socket2 = createClientSocket();
  await connectSocket(socket2);
  const joinResp2 = await new Promise<JoinGameResponse>((resolve) => {
    socket2.emit('joinGame', { gameId, sessionToken: player2.token }, (r: JoinGameResponse) =>
      resolve(r)
    );
  });
  expect(joinResp2.success).toBe(true);

  // Start the game
  const startResp = await new Promise<StartGameResponse>((resolve) => {
    socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
  });
  expect(startResp.success).toBe(true);

  // Get the game state after start to know whose turn it is
  const snapshot = manager.getState(gameId);
  const context = snapshot!.context as GameState;

  return {
    gameId,
    player1: { ...player1, socket: socket1 },
    player2: { ...player2, socket: socket2 },
    gameState: context,
  };
}

/** Helper: find a valid move for the current player */
function findValidMove(
  state: GameState
): { pieceId: string; destination: { q: number; r: number } } | null {
  const currentPlayerId = state.currentPlayerId;
  if (!currentPlayerId) return null;

  // Find pieces belonging to the current player
  const playerPieces = state.pieces.filter(
    (p) => p.playerId === currentPlayerId && (p.type === 'warrior' || p.type === 'jarl')
  );

  for (const piece of playerPieces) {
    const moves = getValidMoves(state, piece.id);
    if (moves.length > 0) {
      return { pieceId: piece.id, destination: moves[0].destination };
    }
  }

  return null;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Socket.IO playTurn handler integration tests', () => {
  beforeAll(async () => {
    await testRedis.connect();

    // Verify database tables exist
    const result = await testPool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('game_snapshots', 'game_events')
       ORDER BY table_name`
    );
    const tables = result.rows.map((r) => r.table_name);
    expect(tables).toContain('game_events');
    expect(tables).toContain('game_snapshots');

    serverPort = await createTestServer();
  });

  afterEach(async () => {
    // Disconnect all client sockets
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
      socket.removeAllListeners();
    }
    clientSockets.length = 0;

    // Shut down the manager and recreate server
    manager?.shutdown();
    io?.close();

    await new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    serverPort = await createTestServer();

    // Clean up database
    await testPool.query(
      `DELETE FROM game_events WHERE game_id IN (
        SELECT game_id FROM game_snapshots WHERE created_at > now() - interval '5 minutes'
      )`
    );
    await testPool.query(
      `DELETE FROM game_snapshots WHERE created_at > now() - interval '5 minutes'`
    );

    // Clean up Redis session keys
    const keys = await testRedis.keys('session:*');
    if (keys.length > 0) {
      await testRedis.del(...keys);
    }
  });

  afterAll(async () => {
    for (const socket of clientSockets) {
      socket.disconnect();
    }

    manager?.shutdown();
    io?.close();

    await new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    await testPool.end();
    await testRedis.quit();
  });

  // ── playTurn handler ──────────────────────────────────────────────

  describe('playTurn handler', () => {
    it('successfully executes a valid move and returns success', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      // Determine which socket is the current player
      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Find a valid move
      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it('broadcasts turnPlayed to all players in the room', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;
      const otherSocket = currentPlayerId === player1.playerId ? player2.socket : player1.socket;

      // Set up listener for turnPlayed on the other player's socket
      const turnPlayedPromise = new Promise<TurnPlayedData>((resolve) => {
        otherSocket.on('turnPlayed', (data: TurnPlayedData) => resolve(data));
      });

      // Also listen on the current player's socket (broadcast goes to all in room)
      const turnPlayedCurrentPromise = new Promise<TurnPlayedData>((resolve) => {
        currentSocket.on('turnPlayed', (data: TurnPlayedData) => resolve(data));
      });

      // Find and execute a valid move
      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      // Both players should receive the turnPlayed broadcast
      const turnDataOther = await turnPlayedPromise;
      expect(turnDataOther.newState).toBeDefined();
      expect(turnDataOther.events).toBeDefined();
      expect(turnDataOther.events.length).toBeGreaterThan(0);
      // Turn should have advanced to the other player
      expect(turnDataOther.newState.currentPlayerId).not.toBe(currentPlayerId);

      const turnDataCurrent = await turnPlayedCurrentPromise;
      expect(turnDataCurrent.newState).toBeDefined();
      expect(turnDataCurrent.newState.currentPlayerId).not.toBe(currentPlayerId);
    });

    it('returns error when socket has not joined a game', async () => {
      // Create game but don't join via socket
      await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      // Try to play a turn without joining
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        socket.emit(
          'playTurn',
          { gameId: 'some-game', command: { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not joined');
    });

    it('returns error for game ID mismatch', async () => {
      const { gameId, player1 } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      // Join one game
      await new Promise<JoinGameResponse>((resolve) => {
        socket.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      // Try to play turn for a different game ID
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        socket.emit(
          'playTurn',
          {
            gameId: 'different-game-id',
            command: { pieceId: 'p1-jarl', destination: { q: 0, r: 0 } },
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('mismatch');
    });

    it("returns error when it is not the player's turn", async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      // Determine which player does NOT have the turn
      const currentPlayerId = gameState.currentPlayerId;
      const wrongSocket = currentPlayerId === player1.playerId ? player2.socket : player1.socket;

      // Find a valid move for the current player's pieces
      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      // Try to play using the wrong player's socket
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        wrongSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('returns error for an invalid move (piece does not exist)', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Try to move a non-existent piece
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          {
            gameId,
            command: { pieceId: 'nonexistent-piece', destination: { q: 0, r: 0 } },
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('returns error for an invalid destination', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Find a piece for the current player
      const playerPiece = gameState.pieces.find(
        (p) => p.playerId === currentPlayerId && p.type === 'warrior'
      );
      expect(playerPiece).toBeDefined();

      // Try to move to an invalid destination (way off board)
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          {
            gameId,
            command: { pieceId: playerPiece!.id, destination: { q: 99, r: 99 } },
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('updates game state correctly after a successful move', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Find a valid move
      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      // Listen for turnPlayed to get the updated state
      const turnPlayedPromise = new Promise<TurnPlayedData>((resolve) => {
        currentSocket.on('turnPlayed', (data: TurnPlayedData) => resolve(data));
      });

      await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      const turnData = await turnPlayedPromise;

      // The piece should have moved to the destination
      const movedPiece = turnData.newState.pieces.find((p) => p.id === move!.pieceId);
      expect(movedPiece).toBeDefined();
      expect(movedPiece!.position).toEqual(move!.destination);

      // The turn should have advanced
      expect(turnData.newState.turnNumber).toBe(gameState.turnNumber + 1);

      // Events should include a MOVE event
      const moveEvent = turnData.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
    });
  });
});
