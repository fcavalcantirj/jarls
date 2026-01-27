import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock persistence before importing anything that uses GameManager
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
});
