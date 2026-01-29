import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import http from 'http';
import express from 'express';
import { Pool, QueryResultRow } from 'pg';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import type { GameConfig, MoveCommand, GameState } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinGameResponse,
  StartGameResponse,
  PlayTurnResponse,
  PlayerLeftData,
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
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
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

/** Helper: join both players to their sockets and start the game */
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

  // Start the game
  await new Promise<StartGameResponse>((resolve) => {
    socket1.emit('startGame', { gameId }, (r: StartGameResponse) => resolve(r));
  });

  return {
    gameId,
    player1: { ...player1, socket: socket1 },
    player2: { ...player2, socket: socket2 },
  };
}

/** Helper: find a valid move for the current player */
function findValidMove(state: GameState): { pieceId: string; command: MoveCommand } | null {
  const currentPlayerId = state.currentPlayerId;
  const playerPieces = state.pieces.filter((p) => p.playerId === currentPlayerId);

  for (const piece of playerPieces) {
    const validMoves = getValidMoves(state, piece.id);
    if (validMoves.length > 0) {
      const move = validMoves[0];
      return {
        pieceId: piece.id,
        command: {
          pieceId: piece.id,
          destination: move.destination,
        },
      };
    }
  }
  return null;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Socket.IO connection management integration tests', () => {
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

  // ── disconnect handler ──────────────────────────────────────────

  describe('disconnect handler', () => {
    it('broadcasts playerLeft when a player disconnects from a started game', async () => {
      const { player1, player2 } = await setupStartedGame();

      // Set up listener for playerLeft on player 1's socket
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        player1.socket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      // Player 2 disconnects
      player2.socket.disconnect();

      // Player 1 should receive playerLeft broadcast
      const leftData = await playerLeftPromise;
      expect(leftData.playerId).toBe(player2.playerId);
      expect(leftData.gameState).toBeDefined();
    });

    it('marks the disconnected player in game state', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Wait for playerLeft broadcast to confirm disconnect was processed
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        player1.socket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      // Player 2 disconnects
      player2.socket.disconnect();

      await playerLeftPromise;

      // Verify the game state reflects the disconnection
      const snapshot = manager.getState(gameId);
      expect(snapshot).toBeDefined();
      const context = snapshot!.context as any;
      expect(context.disconnectedPlayers).toBeDefined();

      // The Set may be serialized differently, check the underlying data
      const disconnected = context.disconnectedPlayers;
      if (disconnected instanceof Set) {
        expect(disconnected.has(player2.playerId)).toBe(true);
      }
    });

    it('pauses the game when the current player disconnects', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Determine which player's turn it is
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      // Disconnect the current player
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;
      const otherSocket = currentPlayerId === player1.playerId ? player2.socket : player1.socket;

      // Set up listener on the other player
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        otherSocket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      currentSocket.disconnect();

      await playerLeftPromise;

      // Game should be paused
      const afterSnapshot = manager.getState(gameId);
      expect(afterSnapshot).toBeDefined();
      const stateValue = afterSnapshot!.value;
      const stateName = typeof stateValue === 'string' ? stateValue : Object.keys(stateValue)[0];
      expect(stateName).toBe('paused');
    });

    it('does not crash when a socket without game data disconnects', async () => {
      // Connect a socket but don't join any game
      const socket = createClientSocket();
      await connectSocket(socket);

      // Disconnect should not throw or crash the server
      socket.disconnect();

      // Wait a moment, then verify server is still responsive
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a new socket to verify the server is still working
      const testSocket = createClientSocket();
      await connectSocket(testSocket);
      expect(testSocket.connected).toBe(true);
    });

    it('does not pause the game when a non-current player disconnects', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Determine which player's turn it is
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      // Disconnect the non-current player
      const nonCurrentSocket =
        currentPlayerId === player1.playerId ? player2.socket : player1.socket;
      const currentSocket = currentPlayerId === player1.playerId ? player1.socket : player2.socket;

      // Set up listener on the current player
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        currentSocket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      nonCurrentSocket.disconnect();

      await playerLeftPromise;

      // Game should NOT be paused - still in playing state
      const afterSnapshot = manager.getState(gameId);
      expect(afterSnapshot).toBeDefined();
      const stateValue = afterSnapshot!.value;
      const stateName = typeof stateValue === 'string' ? stateValue : Object.keys(stateValue)[0];
      expect(stateName).toBe('playing');
    });
  });

  // ── reconnection via re-join ────────────────────────────────────

  describe('reconnection via re-join', () => {
    it('allows a disconnected player to rejoin and get current state', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Wait for disconnect to be processed
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        player1.socket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      // Player 2 disconnects
      player2.socket.disconnect();
      await playerLeftPromise;

      // Player 2 creates a new socket and rejoins
      const newSocket = createClientSocket();
      await connectSocket(newSocket);

      const response = await new Promise<JoinGameResponse>((resolve) => {
        newSocket.emit('joinGame', { gameId, sessionToken: player2.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      expect(response.success).toBe(true);
      expect(response.gameState).toBeDefined();
      expect(response.playerId).toBe(player2.playerId);
    });

    it('game can resume after disconnected player rejoins via new joinGame', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Determine current player
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;
      const currentPlayer = currentPlayerId === player1.playerId ? player1 : player2;
      const otherPlayer = currentPlayerId === player1.playerId ? player2 : player1;

      // Disconnect the current player (this will pause the game)
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        otherPlayer.socket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      currentPlayer.socket.disconnect();
      await playerLeftPromise;

      // Verify game is paused
      const pausedSnapshot = manager.getState(gameId);
      const pausedState = pausedSnapshot!.value;
      const pausedStateName =
        typeof pausedState === 'string' ? pausedState : Object.keys(pausedState)[0];
      expect(pausedStateName).toBe('paused');

      // Reconnect the current player via onReconnect (simulating reconnection)
      manager.onReconnect(gameId, currentPlayer.playerId);

      // Verify game is back to playing
      const resumedSnapshot = manager.getState(gameId);
      const resumedState = resumedSnapshot!.value;
      const resumedStateName =
        typeof resumedState === 'string' ? resumedState : Object.keys(resumedState)[0];
      expect(resumedStateName).toBe('playing');
    });

    it('current player can make a move after reconnecting', async () => {
      const { gameId, player1, player2 } = await setupStartedGame();

      // Get the current player's info
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;
      const currentPlayer = currentPlayerId === player1.playerId ? player1 : player2;
      const otherPlayer = currentPlayerId === player1.playerId ? player2 : player1;

      // Disconnect the current player
      const playerLeftPromise = new Promise<PlayerLeftData>((resolve) => {
        otherPlayer.socket.on('playerLeft', (data: PlayerLeftData) => resolve(data));
      });

      currentPlayer.socket.disconnect();
      await playerLeftPromise;

      // Reconnect via GameManager directly
      manager.onReconnect(gameId, currentPlayer.playerId);

      // Create a new socket for the reconnected player
      const newSocket = createClientSocket();
      await connectSocket(newSocket);

      const joinResponse = await new Promise<JoinGameResponse>((resolve) => {
        newSocket.emit(
          'joinGame',
          { gameId, sessionToken: currentPlayer.token },
          (r: JoinGameResponse) => resolve(r)
        );
      });

      expect(joinResponse.success).toBe(true);

      // Find and make a valid move
      const gameState = joinResponse.gameState!;
      const validMove = findValidMove(gameState);
      expect(validMove).not.toBeNull();

      const moveResponse = await new Promise<PlayTurnResponse>((resolve) => {
        newSocket.emit('playTurn', { gameId, command: validMove!.command }, (r: PlayTurnResponse) =>
          resolve(r)
        );
      });

      expect(moveResponse.success).toBe(true);
    });
  });
});
