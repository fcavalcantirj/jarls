import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
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
} from '../socket/types.js';

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
jest.unstable_mockModule('../db', () => ({
  query: async <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    return testPool.query<T>(text, params);
  },
}));

// Mock redis module to use test redis client
jest.unstable_mockModule('../redis/client', () => ({
  redis: testRedis,
  closeRedis: async () => {
    await testRedis.quit();
  },
}));

// Dynamic imports after mocking
const { GameManager } = await import('../game/manager');
const { createGameRoutes } = await import('../routes/games');
const { errorMiddleware } = await import('../middleware/error');
const { registerSocketHandlers } = await import('../socket/handlers');
const { createSession } = await import('../services/session');

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
let app: ReturnType<typeof express>;
const clientSockets: TypedClientSocket[] = [];

function createTestServer(): Promise<number> {
  return new Promise((resolve) => {
    app = express();
    app.use(express.json());
    app.use('/api/games', createGameRoutes(manager));
    app.use(errorMiddleware);

    httpServer = http.createServer(app);
    io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

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

async function setupStartedGame() {
  const { gameId, player1, player2 } = await createGameWithTwoPlayers();

  const socket1 = createClientSocket();
  await connectSocket(socket1);
  await new Promise<JoinGameResponse>((resolve) => {
    socket1.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
      resolve(r)
    );
  });

  const socket2 = createClientSocket();
  await connectSocket(socket2);
  await new Promise<JoinGameResponse>((resolve) => {
    socket2.emit('joinGame', { gameId, sessionToken: player2.token }, (r: JoinGameResponse) =>
      resolve(r)
    );
  });

  const startResp = await new Promise<StartGameResponse>((resolve) => {
    socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
  });
  expect(startResp.success).toBe(true);

  const snapshot = manager.getState(gameId);
  const context = snapshot!.context as GameState;

  return {
    gameId,
    player1: { ...player1, socket: socket1 },
    player2: { ...player2, socket: socket2 },
    gameState: context,
  };
}

function findValidMove(
  state: GameState
): { pieceId: string; destination: { q: number; r: number } } | null {
  const currentPlayerId = state.currentPlayerId;
  if (!currentPlayerId) return null;

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

describe('Performance: Network latency tests', () => {
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

    manager = new GameManager();
    serverPort = await createTestServer();
  });

  afterEach(async () => {
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
      socket.removeAllListeners();
    }
    clientSockets.length = 0;

    manager?.shutdown();
    io?.close();

    await new Promise<void>((resolve) => {
      if (httpServer) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });

    manager = new GameManager();
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

  // ── REST API Performance ──────────────────────────────────────────

  describe('REST API endpoints respond under 100ms', () => {
    it('GET /api/games responds under 100ms', async () => {
      const start = Date.now();
      const response = await request(app).get('/api/games');
      const elapsed = Date.now() - start;

      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(100);
    });

    it('POST /api/games responds under 100ms', async () => {
      const start = Date.now();
      const response = await request(app).post('/api/games').send({});
      const elapsed = Date.now() - start;

      expect(response.status).toBe(201);
      expect(elapsed).toBeLessThan(100);
    });

    it('POST /api/games/:id/join responds under 100ms', async () => {
      const createResp = await request(app).post('/api/games').send({});
      const gameId = createResp.body.gameId;

      const start = Date.now();
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const elapsed = Date.now() - start;

      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(100);
    });

    it('GET /api/games/:id responds under 100ms (with auth)', async () => {
      const createResp = await request(app).post('/api/games').send({});
      const gameId = createResp.body.gameId;
      const joinResp = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const token = joinResp.body.sessionToken;

      const start = Date.now();
      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${token}`);
      const elapsed = Date.now() - start;

      expect(response.status).toBe(200);
      expect(elapsed).toBeLessThan(100);
    });

    it('average API response time under 100ms across 10 requests', async () => {
      const iterations = 10;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await request(app).get('/api/games');
      }

      const totalElapsed = Date.now() - start;
      const avgElapsed = totalElapsed / iterations;

      expect(avgElapsed).toBeLessThan(100);
    });
  });

  // ── WebSocket Performance ─────────────────────────────────────────

  describe('WebSocket latency under 50ms', () => {
    it('joinGame round-trip completes under 50ms', async () => {
      const { gameId, player1 } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      const start = Date.now();
      const response = await new Promise<JoinGameResponse>((resolve) => {
        socket.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });
      const elapsed = Date.now() - start;

      expect(response.success).toBe(true);
      expect(elapsed).toBeLessThan(50);
    });

    it('startGame round-trip completes under 50ms', async () => {
      const { gameId, player1, player2 } = await createGameWithTwoPlayers();

      const socket1 = createClientSocket();
      await connectSocket(socket1);
      await new Promise<JoinGameResponse>((resolve) => {
        socket1.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      const socket2 = createClientSocket();
      await connectSocket(socket2);
      await new Promise<JoinGameResponse>((resolve) => {
        socket2.emit('joinGame', { gameId, sessionToken: player2.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      const start = Date.now();
      const response = await new Promise<StartGameResponse>((resolve) => {
        socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
      });
      const elapsed = Date.now() - start;

      expect(response.success).toBe(true);
      expect(elapsed).toBeLessThan(50);
    });

    it('playTurn round-trip completes under 50ms', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      const start = Date.now();
      const response = await new Promise<PlayTurnResponse>((resolve) => {
        currentSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          (r: PlayTurnResponse) => resolve(r)
        );
      });
      const elapsed = Date.now() - start;

      expect(response.success).toBe(true);
      expect(elapsed).toBeLessThan(50);
    });

    it('turnPlayed broadcast received under 50ms after playTurn', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const currentPlayerId = gameState.currentPlayerId;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;
      const otherSocket = currentPlayerId === player1.playerId ? player2.socket : player1.socket;

      const move = findValidMove(gameState);
      expect(move).not.toBeNull();

      // Set up listener for the broadcast on the other socket
      const broadcastPromise = new Promise<{ elapsed: number; data: TurnPlayedData }>((resolve) => {
        const start = Date.now();

        otherSocket.on('turnPlayed', (data: TurnPlayedData) => {
          const elapsed = Date.now() - start;
          resolve({ elapsed, data });
        });

        // Emit the move (start timer right before listener setup)
        currentSocket.emit(
          'playTurn',
          { gameId, command: { pieceId: move!.pieceId, destination: move!.destination } },
          () => {
            // callback - move was processed
          }
        );
      });

      const { elapsed, data } = await broadcastPromise;

      expect(data.newState).toBeDefined();
      expect(elapsed).toBeLessThan(50);
    });

    it('average WebSocket round-trip under 50ms across 5 consecutive moves', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      let currentState = gameState;
      const latencies: number[] = [];

      for (let i = 0; i < 5; i++) {
        const currentPlayerId = currentState.currentPlayerId;
        const currentSocket =
          currentPlayerId === player1.playerId ? player1.socket : player2.socket;

        const move = findValidMove(currentState);
        if (!move) break;

        const start = Date.now();
        const response = await new Promise<PlayTurnResponse>((resolve) => {
          currentSocket.emit(
            'playTurn',
            { gameId, command: { pieceId: move.pieceId, destination: move.destination } },
            (r: PlayTurnResponse) => resolve(r)
          );
        });
        const elapsed = Date.now() - start;

        expect(response.success).toBe(true);
        latencies.push(elapsed);

        // Update state for next move
        const snapshot = manager.getState(gameId);
        currentState = snapshot!.context as GameState;
      }

      expect(latencies.length).toBeGreaterThan(0);
      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(50);
    });
  });
});
