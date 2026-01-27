import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock persistence before importing anything that uses GameManager

const mockSaveSnapshotFn = jest
  .fn<(...args: any[]) => Promise<void>>()
  .mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSaveEventFn = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);

const mockLoadActiveSnapshotsFn = jest
  .fn<(...args: any[]) => Promise<any[]>>()
  .mockResolvedValue([]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadSnapshotFn = jest.fn<(...args: any[]) => Promise<null>>().mockResolvedValue(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadEventsFn = jest.fn<(...args: any[]) => Promise<never[]>>().mockResolvedValue([]);

// Mock session service
const mockCreateSessionFn = jest
  .fn<(...args: any[]) => Promise<string>>()
  .mockResolvedValue('mock-session-token-64chars');

const mockValidateSessionFn = jest
  .fn<(...args: any[]) => Promise<any>>()
  .mockResolvedValue({ gameId: 'g1', playerId: 'p1', playerName: 'TestPlayer' });

jest.unstable_mockModule('../../services/session', () => ({
  createSession: mockCreateSessionFn,
  validateSession: mockValidateSessionFn,
  invalidateSession: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  extendSession: jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true),
}));

jest.unstable_mockModule('../../game/persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  loadActiveSnapshots: mockLoadActiveSnapshotsFn,
  VersionConflictError: class VersionConflictError extends Error {},
}));

const { GameManager } = await import('../../game/manager');
const { createGameRoutes } = await import('../games');
const { errorMiddleware } = await import('../../middleware/error');

describe('Game routes', () => {
  let manager: InstanceType<typeof GameManager>;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    manager = new GameManager();
    app = express();
    app.use(express.json());
    app.use('/api/games', createGameRoutes(manager));
    app.use(errorMiddleware);
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('POST /api/games', () => {
    it('creates a game with default config and returns 201 with gameId', async () => {
      const response = await request(app).post('/api/games').send({});

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
      expect(typeof response.body.gameId).toBe('string');
      expect(response.body.gameId.length).toBeGreaterThan(0);
    });

    it('creates a game with custom playerCount', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 3 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
    });

    it('creates a game with turnTimerMs', async () => {
      const response = await request(app).post('/api/games').send({ turnTimerMs: 30000 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
    });

    it('returns 400 for invalid playerCount (too low)', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 1 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('returns 400 for invalid playerCount (too high)', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 7 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('returns 400 for invalid playerCount type', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 'two' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('game appears in listGames after creation', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const listRes = await request(app).get('/api/games');

      expect(listRes.status).toBe(200);
      expect(listRes.body.games).toBeInstanceOf(Array);
      const found = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);
      expect(found).toBeDefined();
      expect(found.status).toBe('lobby');
      expect(found.playerCount).toBe(0);
      expect(found.maxPlayers).toBe(2);
    });
  });

  describe('GET /api/games', () => {
    it('returns empty array when no games exist', async () => {
      const response = await request(app).get('/api/games');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ games: [] });
    });

    it('returns all games', async () => {
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

    it('returns game summary with correct shape', async () => {
      await request(app).post('/api/games').send({});

      const response = await request(app).get('/api/games');
      const game = response.body.games[0];

      expect(game).toHaveProperty('gameId');
      expect(game).toHaveProperty('status');
      expect(game).toHaveProperty('playerCount');
      expect(game).toHaveProperty('maxPlayers');
      expect(game).toHaveProperty('players');
      expect(game.players).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/games/:id', () => {
    it('returns 401 without auth header', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app).get(`/api/games/${gameId}`);

      expect(response.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      mockValidateSessionFn.mockResolvedValueOnce(null);

      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('returns game state with valid auth', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      mockValidateSessionFn.mockResolvedValueOnce({
        gameId,
        playerId: 'p1',
        playerName: 'TestPlayer',
      });

      const response = await request(app)
        .get(`/api/games/${gameId}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('state');
      expect(response.body.state).toHaveProperty('config');
      expect(response.body.state).toHaveProperty('players');
    });

    it('returns 404 for non-existent game', async () => {
      mockValidateSessionFn.mockResolvedValueOnce({
        gameId: 'nonexistent',
        playerId: 'p1',
        playerName: 'TestPlayer',
      });

      const response = await request(app)
        .get('/api/games/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/games/:id/join', () => {
    it('joins a game and returns sessionToken and playerId', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Viking1' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionToken');
      expect(response.body).toHaveProperty('playerId');
      expect(typeof response.body.sessionToken).toBe('string');
      expect(typeof response.body.playerId).toBe('string');
    });

    it('calls createSession with correct args', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      mockCreateSessionFn.mockClear();

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking1' });

      expect(mockCreateSessionFn).toHaveBeenCalledTimes(1);
      const [calledGameId, calledPlayerId, calledName] = mockCreateSessionFn.mock.calls[0];
      expect(calledGameId).toBe(gameId);
      expect(typeof calledPlayerId).toBe('string');
      expect(calledName).toBe('Viking1');
    });

    it('returns 400 for missing playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app).post(`/api/games/${gameId}/join`).send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('returns 400 for empty playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('returns 404 for non-existent game', async () => {
      const response = await request(app)
        .post('/api/games/nonexistent/join')
        .send({ playerName: 'Viking1' });

      expect(response.status).toBe(404);
    });

    it('player appears in game after joining', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking1' });

      const listRes = await request(app).get('/api/games');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);

      expect(game.playerCount).toBe(1);
      expect(game.players).toHaveLength(1);
      expect(game.players[0].name).toBe('Viking1');
    });

    it('returns error when game is full', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      // Join two players (max for default 2-player game)
      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking1' });
      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking2' });

      // Third player should fail
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Viking3' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/games/:id/start', () => {
    async function createGameWithPlayers() {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Viking1' });
      const hostPlayerId = join1.body.playerId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking2' });

      return { gameId, hostPlayerId };
    }

    it('returns 401 without auth header', async () => {
      const { gameId } = await createGameWithPlayers();

      const response = await request(app).post(`/api/games/${gameId}/start`);

      expect(response.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      mockValidateSessionFn.mockResolvedValueOnce(null);
      const { gameId } = await createGameWithPlayers();

      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent game', async () => {
      mockValidateSessionFn.mockResolvedValueOnce({
        gameId: 'nonexistent',
        playerId: 'p1',
        playerName: 'TestPlayer',
      });

      const response = await request(app)
        .post('/api/games/nonexistent/start')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('returns 401 when non-host tries to start', async () => {
      const { gameId } = await createGameWithPlayers();

      // Authenticate as a non-host player
      mockValidateSessionFn.mockResolvedValueOnce({
        gameId,
        playerId: 'not-the-host',
        playerName: 'Imposter',
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(401);
    });

    it('starts game successfully when host requests', async () => {
      const { gameId, hostPlayerId } = await createGameWithPlayers();

      mockValidateSessionFn.mockResolvedValueOnce({
        gameId,
        playerId: hostPlayerId,
        playerName: 'Viking1',
      });

      const response = await request(app)
        .post(`/api/games/${gameId}/start`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });

      // Verify game is now in playing state
      const listRes = await request(app).get('/api/games?status=playing');
      const game = listRes.body.games.find((g: { gameId: string }) => g.gameId === gameId);
      expect(game).toBeDefined();
      expect(game.status).toBe('playing');
    });
  });

  describe('GET /api/games/:id/valid-moves/:pieceId', () => {
    async function createAndStartGame() {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const join1 = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Viking1' });
      const hostPlayerId = join1.body.playerId;

      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Viking2' });

      // Start the game
      manager.start(gameId, hostPlayerId);

      return { gameId };
    }

    it('returns 401 without auth header', async () => {
      const { gameId } = await createAndStartGame();

      const response = await request(app).get(`/api/games/${gameId}/valid-moves/some-piece`);

      expect(response.status).toBe(401);
    });

    it('returns 404 for non-existent game', async () => {
      mockValidateSessionFn.mockResolvedValueOnce({
        gameId: 'nonexistent',
        playerId: 'p1',
        playerName: 'TestPlayer',
      });

      const response = await request(app)
        .get('/api/games/nonexistent/valid-moves/some-piece')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('returns moves array for a valid piece', async () => {
      const { gameId } = await createAndStartGame();

      // Get the game state to find a valid piece belonging to the current player
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;
      const playerPiece = context.pieces.find(
        (p: any) => p.playerId === currentPlayerId && p.type === 'warrior'
      );
      expect(playerPiece).toBeDefined();

      mockValidateSessionFn.mockResolvedValueOnce({
        gameId,
        playerId: currentPlayerId,
        playerName: 'Viking1',
      });

      const response = await request(app)
        .get(`/api/games/${gameId}/valid-moves/${playerPiece.id}`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('moves');
      expect(Array.isArray(response.body.moves)).toBe(true);
    });

    it('returns empty array for non-existent piece', async () => {
      const { gameId } = await createAndStartGame();

      mockValidateSessionFn.mockResolvedValueOnce({
        gameId,
        playerId: 'any-player',
        playerName: 'Viking1',
      });

      const response = await request(app)
        .get(`/api/games/${gameId}/valid-moves/nonexistent-piece`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ moves: [] });
    });
  });
});
