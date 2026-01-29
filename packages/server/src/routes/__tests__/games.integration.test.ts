import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Pool, QueryResultRow } from 'pg';
import Redis from 'ioredis';

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
let GameManager: any,
  createGameRoutes: any,
  errorMiddleware: any,
  createSession: any,
  validateSession: any;

beforeAll(async () => {
  ({ GameManager } = await import('../../game/manager'));
  ({ createGameRoutes } = await import('../games'));
  ({ errorMiddleware } = await import('../../middleware/error'));
  ({ createSession, validateSession } = await import('../../services/session'));
});

// ── Test helpers ────────────────────────────────────────────────────

function createApp(manager: InstanceType<typeof GameManager>) {
  const app = express();
  app.use(express.json());
  app.use('/api/games', createGameRoutes(manager));
  app.use(errorMiddleware);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('REST API integration tests', () => {
  let manager: InstanceType<typeof GameManager>;
  let app: ReturnType<typeof express>;

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
  });

  beforeAll(() => {
    manager = new GameManager();
    app = createApp(manager);
  });

  afterEach(async () => {
    manager.shutdown();
    manager = new GameManager();
    app = createApp(manager);

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
    manager?.shutdown();
    await testPool.end();
    await testRedis.quit();
  });

  // ── POST /api/games ───────────────────────────────────────────

  describe('POST /api/games', () => {
    it('creates a game and returns 201 with gameId', async () => {
      const response = await request(app).post('/api/games').send({});

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
      expect(typeof response.body.gameId).toBe('string');
      expect(response.body.gameId.length).toBeGreaterThan(0);
    });

    it('persists game snapshot to database', async () => {
      const response = await request(app).post('/api/games').send({});
      const gameId = response.body.gameId;

      // Wait a tick for async persistence
      await new Promise((r) => setTimeout(r, 200));

      const dbResult = await testPool.query(`SELECT * FROM game_snapshots WHERE game_id = $1`, [
        gameId,
      ]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].status).toBe('lobby');
    });

    it('returns 400 for invalid playerCount', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 1 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  // ── GET /api/games ────────────────────────────────────────────

  describe('GET /api/games', () => {
    it('returns empty array when no games', async () => {
      const response = await request(app).get('/api/games');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ games: [] });
    });

    it('returns created games', async () => {
      await request(app).post('/api/games').send({});
      await request(app).post('/api/games').send({});

      const response = await request(app).get('/api/games');

      expect(response.status).toBe(200);
      expect(response.body.games).toHaveLength(2);
    });

    it('filters games by status', async () => {
      await request(app).post('/api/games').send({});

      const lobbyRes = await request(app).get('/api/games?status=lobby');
      expect(lobbyRes.body.games).toHaveLength(1);

      const playingRes = await request(app).get('/api/games?status=playing');
      expect(playingRes.body.games).toHaveLength(0);
    });
  });

  // ── POST /api/games/:id/join ──────────────────────────────────

  describe('POST /api/games/:id/join', () => {
    it('joins game and returns a real session token stored in Redis', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const joinRes = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body).toHaveProperty('sessionToken');
      expect(joinRes.body).toHaveProperty('playerId');

      // Verify token is stored in Redis and valid
      const token = joinRes.body.sessionToken;
      expect(token.length).toBe(64);

      const sessionData = await validateSession(token);
      expect(sessionData).not.toBeNull();
      expect(sessionData!.gameId).toBe(gameId);
      expect(sessionData!.playerId).toBe(joinRes.body.playerId);
      expect(sessionData!.playerName).toBe('Ragnar');
    });

    it('returns 400 for missing playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app).post(`/api/games/${gameId}/join`).send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('returns 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/games/nonexistent/join')
        .send({ playerName: 'Ragnar' });

      expect(response.status).toBe(404);
    });

    it('player shows up in game listing after join', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Ragnar' });

      const listRes = await request(app).get('/api/games');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);

      expect(game.playerCount).toBe(1);
      expect(game.players[0].name).toBe('Ragnar');
    });

    it('returns error when game is full', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P1' });
      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P2' });

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'P3' });

      expect(response.status).toBe(500);
    });
  });

  // ── GET /api/games/:id (auth required) ────────────────────────

  describe('GET /api/games/:id', () => {
    it('returns 401 without auth header', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app).get(`/api/games/${gameId}`);

      expect(response.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', 'Bearer bad-token');

      expect(response.status).toBe(401);
    });

    it('returns game state with a real session token', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      // Join to get a real session token
      const joinRes = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const token = joinRes.body.sessionToken;

      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('state');
      expect(response.body.state).toHaveProperty('config');
      expect(response.body.state).toHaveProperty('players');
      expect(response.body.state.players).toHaveLength(1);
      expect(response.body.state.players[0].name).toBe('Ragnar');
    });

    it('returns 404 for non-existent game', async () => {
      // Create a session for a game that doesn't exist in manager
      const token = await createSession('nonexistent', 'p1', 'Test');

      const response = await request(app)
        .get('/api/games/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  // ── POST /api/games/:id/start (auth required, host only) ─────

  describe('POST /api/games/:id/start', () => {
    async function createGameWithTwoPlayers() {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Host' });
      const hostToken = join1.body.sessionToken;
      const hostPlayerId = join1.body.playerId;

      const join2 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Guest' });
      const guestToken = join2.body.sessionToken;

      return { gameId, hostToken, hostPlayerId, guestToken };
    }

    it('returns 401 without auth', async () => {
      const { gameId } = await createGameWithTwoPlayers();

      const response = await request(app).post(`/api/games/${gameId}/start`);

      expect(response.status).toBe(401);
    });

    it('returns 401 when non-host tries to start', async () => {
      const { gameId, guestToken } = await createGameWithTwoPlayers();

      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(response.status).toBe(401);
    });

    it('starts game successfully when host requests', async () => {
      const { gameId, hostToken } = await createGameWithTwoPlayers();

      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Verify game transitioned to playing
      const listRes = await request(app).get('/api/games?status=playing');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);
      expect(game).toBeDefined();
      expect(game.status).toBe('playing');
    });

    it('persists game events to database after start', async () => {
      const { gameId, hostToken } = await createGameWithTwoPlayers();

      await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      // Wait for async persistence
      await new Promise((r) => setTimeout(r, 300));

      const eventsResult = await testPool.query(
        `SELECT * FROM game_events WHERE game_id = $1 ORDER BY created_at`,
        [gameId]
      );
      // Should have at least the game created event and state transitions
      expect(eventsResult.rows.length).toBeGreaterThan(0);
    });
  });

  // ── GET /api/games/:id/valid-moves/:pieceId (auth required) ───

  describe('GET /api/games/:id/valid-moves/:pieceId', () => {
    async function createAndStartGame() {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Host' });
      const hostToken = join1.body.sessionToken;
      const hostPlayerId = join1.body.playerId;

      const join2 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Guest' });
      const guestToken = join2.body.sessionToken;
      const guestPlayerId = join2.body.playerId;

      // Start the game
      manager.start(gameId, hostPlayerId);

      return { gameId, hostToken, hostPlayerId, guestToken, guestPlayerId };
    }

    it('returns 401 without auth', async () => {
      const { gameId } = await createAndStartGame();

      const response = await request(app).get(`/api/games/${gameId}/valid-moves/some-piece`);

      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent game', async () => {
      const token = await createSession('nonexistent', 'p1', 'Test');

      const response = await request(app)
        .get('/api/games/nonexistent/valid-moves/some-piece')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('returns valid moves for a current player piece', async () => {
      const { gameId, hostToken, hostPlayerId, guestToken } = await createAndStartGame();

      // Find the current player and their token
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      const token = currentPlayerId === hostPlayerId ? hostToken : guestToken;

      // Find a warrior belonging to the current player
      const playerPiece = context.pieces.find(
        (p: any) => p.playerId === currentPlayerId && p.type === 'warrior'
      );
      expect(playerPiece).toBeDefined();

      const response = await request(app)
        .get(`/api/games/${gameId}/valid-moves/${playerPiece.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('moves');
      expect(Array.isArray(response.body.moves)).toBe(true);
    });

    it('returns empty array for non-existent piece', async () => {
      const { gameId, hostToken } = await createAndStartGame();

      const response = await request(app)
        .get(`/api/games/${gameId}/valid-moves/nonexistent-piece`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ moves: [] });
    });
  });

  // ── POST /api/games/:id/ai (add AI player) ────────────────────

  describe('POST /api/games/:id/ai', () => {
    it('returns 401 without auth', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/ai`)
        .send({ difficulty: 'heuristic' });

      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent game', async () => {
      const token = await createSession('nonexistent', 'p1', 'Test');

      const response = await request(app)
        .post('/api/games/nonexistent/ai')
        .set('Authorization', `Bearer ${token}`)
        .send({ difficulty: 'heuristic' });

      expect(response.status).toBe(404);
    });

    it('adds AI player to game and returns aiPlayerId', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const joinRes = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const token = joinRes.body.sessionToken;

      const response = await request(app)
        .post(`/api/games/${gameId}/ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({ difficulty: 'heuristic' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('aiPlayerId');
      expect(typeof response.body.aiPlayerId).toBe('string');
    });

    it('AI player shows up in game listing after add', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const joinRes = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const token = joinRes.body.sessionToken;

      await request(app)
        .post(`/api/games/${gameId}/ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({ difficulty: 'random' });

      const listRes = await request(app).get('/api/games');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);

      expect(game.playerCount).toBe(2);
      expect(game.players).toHaveLength(2);
      // AI player has a Norse name
      expect(game.players[1].name).toBeTruthy();
    });

    it('returns 400 for invalid difficulty', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const joinRes = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      const token = joinRes.body.sessionToken;

      const response = await request(app)
        .post(`/api/games/${gameId}/ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({ difficulty: 'impossible' });

      expect(response.status).toBe(400);
    });

    it('returns error when game is full', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P1' });
      const token = join1.body.sessionToken;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'P2' });

      const response = await request(app)
        .post(`/api/games/${gameId}/ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({ difficulty: 'heuristic' });

      expect(response.status).toBe(500);
    });

    it('returns error when game already started', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Host' });
      const hostToken = join1.body.sessionToken;
      const hostPlayerId = join1.body.playerId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Guest' });

      // Start the game
      manager.start(gameId, hostPlayerId);

      const response = await request(app)
        .post(`/api/games/${gameId}/ai`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ difficulty: 'heuristic' });

      expect(response.status).toBe(500);
    });
  });

  // ── Full game lifecycle ───────────────────────────────────────

  describe('full game lifecycle', () => {
    it('creates game, joins players, starts, and retrieves state', async () => {
      // 1. Create game
      const createRes = await request(app).post('/api/games').send({});
      expect(createRes.status).toBe(201);
      const gameId = createRes.body.gameId;

      // 2. Join player 1 (host)
      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });
      expect(join1.status).toBe(200);
      const hostToken = join1.body.sessionToken;

      // 3. Join player 2
      const join2 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Lagertha' });
      expect(join2.status).toBe(200);

      // 4. Verify game listing shows 2 players
      const listRes = await request(app).get('/api/games');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);
      expect(game.playerCount).toBe(2);

      // 5. Start game as host
      const startRes = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(startRes.status).toBe(200);

      // 6. Get game state with host token
      const stateRes = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.state.players).toHaveLength(2);
      expect(stateRes.body.state.pieces.length).toBeGreaterThan(0);

      // 7. Verify game is in playing status
      const playingRes = await request(app).get('/api/games?status=playing');
      const playingGame = playingRes.body.games.find(
        (g: { gameId: string }) => g.gameId === gameId
      );
      expect(playingGame).toBeDefined();
      expect(playingGame.status).toBe('playing');
    });
  });
});
