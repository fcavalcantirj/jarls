import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import http from 'http';
import express from 'express';
import { Pool, QueryResultRow } from 'pg';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import type { GameConfig } from '@jarls/shared';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinGameResponse,
  StartGameResponse,
  PlayerJoinedData,
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

// ── Tests ───────────────────────────────────────────────────────────

describe('Socket.IO lifecycle handler integration tests', () => {
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

  // ── joinGame handler ────────────────────────────────────────────

  describe('joinGame handler', () => {
    it('successfully joins a game with valid session token', async () => {
      const { gameId, player1 } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      const response = await new Promise<JoinGameResponse>((resolve) => {
        socket.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      expect(response.success).toBe(true);
      expect(response.playerId).toBe(player1.playerId);
      expect(response.gameState).toBeDefined();
      expect(response.gameState!.players).toHaveLength(2);
    });

    it('returns error for invalid session token', async () => {
      const { gameId } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      const response = await new Promise<JoinGameResponse>((resolve) => {
        socket.emit(
          'joinGame',
          { gameId, sessionToken: 'invalid-token-that-does-not-exist' },
          (r: JoinGameResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid or expired session');
    });

    it('returns error when session does not match game', async () => {
      const { player1 } = await createGameWithTwoPlayers();

      // Create a different game
      const otherGameId = await manager.create({ config: createTestConfig() });

      const socket = createClientSocket();
      await connectSocket(socket);

      // Try to join the other game with player1's token (which is for the first game)
      const response = await new Promise<JoinGameResponse>((resolve) => {
        socket.emit(
          'joinGame',
          { gameId: otherGameId, sessionToken: player1.token },
          (r: JoinGameResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('does not match');
    });

    it('returns error for non-existent game', async () => {
      // Create a session for a game that doesn't exist
      const token = await createSession('nonexistent-game', 'p1', 'Test');

      const socket = createClientSocket();
      await connectSocket(socket);

      const response = await new Promise<JoinGameResponse>((resolve) => {
        socket.emit(
          'joinGame',
          { gameId: 'nonexistent-game', sessionToken: token },
          (r: JoinGameResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('broadcasts playerJoined to other players in the room', async () => {
      const { gameId, player1, player2 } = await createGameWithTwoPlayers();

      // Player 1 connects and joins the game
      const socket1 = createClientSocket();
      await connectSocket(socket1);

      await new Promise<JoinGameResponse>((resolve) => {
        socket1.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      // Set up listener for playerJoined on player 1's socket
      const playerJoinedPromise = new Promise<PlayerJoinedData>((resolve) => {
        socket1.on('playerJoined', (data: PlayerJoinedData) => resolve(data));
      });

      // Player 2 connects and joins the game
      const socket2 = createClientSocket();
      await connectSocket(socket2);

      await new Promise<JoinGameResponse>((resolve) => {
        socket2.emit('joinGame', { gameId, sessionToken: player2.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      // Player 1 should have received playerJoined broadcast
      const joinedData = await playerJoinedPromise;
      expect(joinedData.playerId).toBe(player2.playerId);
      expect(joinedData.playerName).toBe('Lagertha');
      expect(joinedData.gameState).toBeDefined();
    });
  });

  // ── startGame handler ───────────────────────────────────────────

  describe('startGame handler', () => {
    it('successfully starts a game when host requests', async () => {
      const { gameId, player1, player2 } = await createGameWithTwoPlayers();

      // Both players connect and join
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

      // Host starts the game
      const response = await new Promise<StartGameResponse>((resolve) => {
        socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
      });

      expect(response.success).toBe(true);

      // Verify the game is now in playing state
      const snapshot = manager.getState(gameId);
      expect(snapshot).toBeDefined();
      const stateValue = snapshot!.value;
      const stateStr = typeof stateValue === 'string' ? stateValue : JSON.stringify(stateValue);
      expect(stateStr).toContain('playing');
    });

    it('broadcasts gameState to all players after start', async () => {
      const { gameId, player1, player2 } = await createGameWithTwoPlayers();

      // Both players connect and join
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

      // Set up listener for gameState on player 2
      const gameStatePromise = new Promise<any>((resolve) => {
        socket2.on('gameState', (state: any) => resolve(state));
      });

      // Host starts the game
      await new Promise<StartGameResponse>((resolve) => {
        socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
      });

      // Player 2 should receive the new game state
      const state = await gameStatePromise;
      expect(state).toBeDefined();
      expect(state.pieces).toBeDefined();
      expect(state.pieces.length).toBeGreaterThan(0);
      expect(state.currentPlayerId).toBeDefined();
    });

    it('returns error when socket has not joined a game', async () => {
      const { gameId } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      // Try to start without joining first
      const response = await new Promise<StartGameResponse>((resolve) => {
        socket.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not joined');
    });

    it('returns error when non-host tries to start', async () => {
      const { gameId, player1, player2 } = await createGameWithTwoPlayers();

      // Both players connect and join
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

      // Non-host (player 2) tries to start
      const response = await new Promise<StartGameResponse>((resolve) => {
        socket2.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('returns error for game ID mismatch', async () => {
      const { gameId, player1 } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      // Join the game first
      await new Promise<JoinGameResponse>((resolve) => {
        socket.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      // Try to start a different game ID
      const response = await new Promise<StartGameResponse>((resolve) => {
        socket.emit('startGame', { gameId: 'different-game-id' }, (r: StartGameResponse) =>
          resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('mismatch');
    });
  });
});
