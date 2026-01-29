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

// Dynamic imports after mocking - loaded in beforeAll
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GameManager: any, registerSocketHandlers: any, createSession: any;

beforeAll(async () => {
  ({ GameManager } = await import('../../game/manager'));
  ({ registerSocketHandlers } = await import('../handlers'));
  ({ createSession } = await import('../../services/session'));
});

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

/** Helper: find a second valid move for the same player (different piece) */
function findAnotherValidMove(
  state: GameState,
  excludePieceId: string
): { pieceId: string; destination: { q: number; r: number } } | null {
  const currentPlayerId = state.currentPlayerId;
  if (!currentPlayerId) return null;

  const playerPieces = state.pieces.filter(
    (p) =>
      p.playerId === currentPlayerId &&
      (p.type === 'warrior' || p.type === 'jarl') &&
      p.id !== excludePieceId
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

describe('Socket.IO playTurn concurrency tests', () => {
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

  describe('concurrent move rejection', () => {
    it('only allows one move when same player sends two moves simultaneously', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      // Determine which socket is the current player
      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Find two different valid moves for the current player
      const move1 = findValidMove(gameState);
      expect(move1).not.toBeNull();

      const move2 = findAnotherValidMove(gameState, move1!.pieceId);
      expect(move2).not.toBeNull();

      // Send both moves concurrently without awaiting
      const responsePromises = [
        new Promise<PlayTurnResponse>((resolve) => {
          currentSocket.emit(
            'playTurn',
            {
              gameId,
              command: { pieceId: move1!.pieceId, destination: move1!.destination },
              turnNumber: gameState.turnNumber,
            },
            (r: PlayTurnResponse) => resolve(r)
          );
        }),
        new Promise<PlayTurnResponse>((resolve) => {
          currentSocket.emit(
            'playTurn',
            {
              gameId,
              command: { pieceId: move2!.pieceId, destination: move2!.destination },
              turnNumber: gameState.turnNumber,
            },
            (r: PlayTurnResponse) => resolve(r)
          );
        }),
      ];

      const [response1, response2] = await Promise.all(responsePromises);

      // Exactly one should succeed, one should fail
      const successCount = [response1.success, response2.success].filter(Boolean).length;
      expect(successCount).toBe(1);

      // Verify the game state shows only one move was applied
      const finalSnapshot = manager.getState(gameId);
      const finalState = finalSnapshot!.context as GameState;

      // Turn should have advanced by exactly 1
      expect(finalState.turnNumber).toBe(gameState.turnNumber + 1);

      // Current player should have changed (to the other player)
      expect(finalState.currentPlayerId).not.toBe(currentPlayerId);
    });

    it('rejects move with stale turnNumber', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      // Send with an incorrect (future) turn number
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          {
            gameId,
            command: { pieceId: move!.pieceId, destination: move!.destination },
            turnNumber: gameState.turnNumber + 100, // Stale/wrong turn number
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Stale move request');
    });

    it('accepts move with correct turnNumber', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          {
            gameId,
            command: { pieceId: move!.pieceId, destination: move!.destination },
            turnNumber: gameState.turnNumber,
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(true);
    });

    it('accepts move without turnNumber (backwards compatibility)', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      // Send without turnNumber
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          {
            gameId,
            command: { pieceId: move!.pieceId, destination: move!.destination },
          },
          (r: PlayTurnResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(true);
    });

    it('mutex prevents race condition between concurrent moves from same socket', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      const move1 = findValidMove(gameState);
      expect(move1).not.toBeNull();

      const move2 = findAnotherValidMove(gameState, move1!.pieceId);
      expect(move2).not.toBeNull();

      // Fire off 5 moves rapidly (stress test)
      const promises: Promise<PlayTurnResponse>[] = [];
      for (let i = 0; i < 5; i++) {
        const move = i % 2 === 0 ? move1 : move2;
        promises.push(
          new Promise<PlayTurnResponse>((resolve) => {
            currentSocket.emit(
              'playTurn',
              {
                gameId,
                command: { pieceId: move!.pieceId, destination: move!.destination },
                turnNumber: gameState.turnNumber,
              },
              (r: PlayTurnResponse) => resolve(r)
            );
          })
        );
      }

      const responses = await Promise.all(promises);

      // Exactly one should succeed
      const successCount = responses.filter((r) => r.success).length;
      expect(successCount).toBe(1);

      // Game state should show only one move applied
      const finalSnapshot = manager.getState(gameId);
      const finalState = finalSnapshot!.context as GameState;
      expect(finalState.turnNumber).toBe(gameState.turnNumber + 1);
    });
  });
});
