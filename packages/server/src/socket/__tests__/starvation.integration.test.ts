import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import http from 'http';
import express from 'express';
import { Pool, QueryResultRow } from 'pg';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinGameResponse,
  StartGameResponse,
  PlayTurnResponse,
  StarvationChoiceResponse,
  StarvationRequiredData,
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

// Dynamic imports after mocking (db + redis only)
const { GameManager } = await import('../../game/manager.js');
const { registerSocketHandlers } = await import('../handlers.js');
const { createSession } = await import('../../services/session.js');
const { getValidMoves } = await import('@jarls/shared');

// We need these types for runtime use
type GameState = import('@jarls/shared').GameState;
type GameConfig = import('@jarls/shared').GameConfig;

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
    io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

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

/** Create a game, join two players, return session info */
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

/** Connect sockets, join game, start, return full context */
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

/** Find a valid move for the current player */
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

/**
 * Play alternating moves until starvation triggers.
 * After the game starts, we forcefully set roundsSinceElimination on the
 * game actor's context via the actor's internal state, then play one full
 * round to trigger starvation at round 10.
 */
async function playToStarvation(
  gameId: string,
  player1: { playerId: string; socket: TypedClientSocket },
  player2: { playerId: string; socket: TypedClientSocket },
  currentState: GameState
): Promise<void> {
  let state = currentState;

  // We need to play enough rounds to get roundsSinceElimination >= 10.
  // Each round = 2 moves (both players). We start at round 0.
  // We need 10 rounds = 20 moves with no eliminations.
  for (let i = 0; i < 20; i++) {
    const currentSocket =
      state.currentPlayerId === player1.playerId ? player1.socket : player2.socket;
    const otherSocket =
      state.currentPlayerId === player1.playerId ? player2.socket : player1.socket;

    const move = findValidMove(state);
    if (!move) {
      throw new Error(`No valid moves found at iteration ${i}`);
    }

    const turnPlayedPromise = new Promise<TurnPlayedData>((resolve) => {
      otherSocket.on('turnPlayed', (data: TurnPlayedData) => {
        otherSocket.removeAllListeners('turnPlayed');
        resolve(data);
      });
    });

    const resp = await new Promise<PlayTurnResponse>((resolve) => {
      currentSocket.emit(
        'playTurn',
        { gameId, command: { pieceId: move.pieceId, destination: move.destination } },
        (r: PlayTurnResponse) => resolve(r)
      );
    });

    if (!resp.success) {
      throw new Error(`Move failed at iteration ${i}: ${resp.error}`);
    }

    // Check if starvation was triggered (state machine transitioned)
    const snapshot = manager.getState(gameId);
    if (snapshot) {
      const stateValue = snapshot.value;
      const stateName = typeof stateValue === 'string' ? stateValue : Object.keys(stateValue)[0];
      if (stateName === 'starvation') {
        return; // Starvation triggered!
      }
    }

    const turnData = await turnPlayedPromise;
    state = turnData.newState;

    // If game ended during moves (e.g., jarl captured), bail
    if (state.phase === 'ended') {
      throw new Error(`Game ended unexpectedly at iteration ${i}`);
    }
  }

  throw new Error('Failed to trigger starvation after 20 moves');
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Socket.IO starvation handler integration tests', () => {
  beforeAll(async () => {
    await testRedis.connect();

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

    serverPort = await createTestServer();

    await testPool.query(
      `DELETE FROM game_events WHERE game_id IN (
        SELECT game_id FROM game_snapshots WHERE created_at > now() - interval '5 minutes'
      )`
    );
    await testPool.query(
      `DELETE FROM game_snapshots WHERE created_at > now() - interval '5 minutes'`
    );

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

  describe('starvation trigger after move', () => {
    it('broadcasts starvationRequired when starvation is triggered', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const starvationP1 = new Promise<StarvationRequiredData>((resolve) => {
        player1.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });
      const starvationP2 = new Promise<StarvationRequiredData>((resolve) => {
        player2.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });

      await playToStarvation(gameId, player1, player2, gameState);

      const s1 = await starvationP1;
      const s2 = await starvationP2;

      expect(s1.candidates).toBeDefined();
      expect(s1.candidates.length).toBeGreaterThan(0);
      expect(s1.timeoutMs).toBeDefined();

      expect(s2.candidates).toBeDefined();
      expect(s2.candidates.length).toBe(s1.candidates.length);
    }, 30_000);
  });

  describe('starvationChoice handler', () => {
    it('successfully submits a starvation choice and returns success', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const starvationP1 = new Promise<StarvationRequiredData>((resolve) => {
        player1.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });

      await playToStarvation(gameId, player1, player2, gameState);
      const starvationData = await starvationP1;

      const p1Candidates = starvationData.candidates.find((c) => c.playerId === player1.playerId);
      expect(p1Candidates).toBeDefined();
      expect(p1Candidates!.candidates.length).toBeGreaterThan(0);

      const choiceResp = await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: p1Candidates!.candidates[0].id },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(choiceResp.success).toBe(true);
    }, 30_000);

    it('resolves starvation and broadcasts gameState when all choices are made', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const starvationP1 = new Promise<StarvationRequiredData>((resolve) => {
        player1.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });

      await playToStarvation(gameId, player1, player2, gameState);
      const starvationData = await starvationP1;

      const gameStateP1 = new Promise<GameState>((resolve) => {
        player1.socket.on('gameState', (state: GameState) => resolve(state));
      });

      const p1Candidates = starvationData.candidates.find((c) => c.playerId === player1.playerId);
      const p2Candidates = starvationData.candidates.find((c) => c.playerId === player2.playerId);
      expect(p1Candidates).toBeDefined();
      expect(p2Candidates).toBeDefined();

      await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: p1Candidates!.candidates[0].id },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      await new Promise<StarvationChoiceResponse>((resolve) => {
        player2.socket.emit(
          'starvationChoice',
          { gameId, pieceId: p2Candidates!.candidates[0].id },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      const updatedState = await gameStateP1;
      expect(updatedState.phase).toBe('playing');
      expect(updatedState.roundsSinceElimination).toBe(0);
    }, 30_000);

    it('returns error when socket has not joined a game', async () => {
      const socket = createClientSocket();
      await connectSocket(socket);

      const response = await new Promise<StarvationChoiceResponse>((resolve) => {
        socket.emit(
          'starvationChoice',
          { gameId: 'some-game', pieceId: 'some-piece' },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not joined');
    });

    it('returns error for game ID mismatch', async () => {
      const { gameId, player1 } = await createGameWithTwoPlayers();

      const socket = createClientSocket();
      await connectSocket(socket);

      await new Promise<JoinGameResponse>((resolve) => {
        socket.emit('joinGame', { gameId, sessionToken: player1.token }, (r: JoinGameResponse) =>
          resolve(r)
        );
      });

      const response = await new Promise<StarvationChoiceResponse>((resolve) => {
        socket.emit(
          'starvationChoice',
          { gameId: 'different-game-id', pieceId: 'some-piece' },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('mismatch');
    });

    it('returns error when game is not in starvation state', async () => {
      const { gameId, player1 } = await setupStartedGame();

      const response = await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: 'some-piece' },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('returns error for invalid candidate piece', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const starvationP1 = new Promise<StarvationRequiredData>((resolve) => {
        player1.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });

      await playToStarvation(gameId, player1, player2, gameState);
      await starvationP1;

      const response = await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: 'nonexistent-piece' },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    }, 30_000);

    it('returns error for duplicate submission from same player', async () => {
      const { gameId, player1, player2, gameState } = await setupStartedGame();

      const starvationP1 = new Promise<StarvationRequiredData>((resolve) => {
        player1.socket.on('starvationRequired', (data: StarvationRequiredData) => resolve(data));
      });

      await playToStarvation(gameId, player1, player2, gameState);
      const starvationData = await starvationP1;

      const p1Candidates = starvationData.candidates.find((c) => c.playerId === player1.playerId);
      expect(p1Candidates).toBeDefined();

      const resp1 = await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: p1Candidates!.candidates[0].id },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });
      expect(resp1.success).toBe(true);

      const resp2 = await new Promise<StarvationChoiceResponse>((resolve) => {
        player1.socket.emit(
          'starvationChoice',
          { gameId, pieceId: p1Candidates!.candidates[0].id },
          (r: StarvationChoiceResponse) => resolve(r)
        );
      });

      expect(resp2.success).toBe(false);
      expect(resp2.error).toContain('already submitted');
    }, 30_000);
  });
});
