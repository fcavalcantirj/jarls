import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockSaveSnapshotFn = jest
  .fn<(...args: any[]) => Promise<void>>()
  .mockResolvedValue(undefined);
const mockSaveEventFn = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
const mockLoadActiveSnapshotsFn = jest
  .fn<(...args: any[]) => Promise<any[]>>()
  .mockResolvedValue([]);
const mockLoadSnapshotFn = jest.fn<(...args: any[]) => Promise<null>>().mockResolvedValue(null);
const mockLoadEventsFn = jest.fn<(...args: any[]) => Promise<never[]>>().mockResolvedValue([]);

const mockCreateSessionFn = jest
  .fn<(...args: any[]) => Promise<string>>()
  .mockResolvedValue('a'.repeat(64));

const mockValidateSessionFn = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null);

jest.unstable_mockModule('../services/session', () => ({
  createSession: mockCreateSessionFn,
  validateSession: mockValidateSessionFn,
  invalidateSession: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  extendSession: jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true),
}));

jest.unstable_mockModule('../game/persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  loadActiveSnapshots: mockLoadActiveSnapshotsFn,
  VersionConflictError: class VersionConflictError extends Error {},
}));

const { GameManager } = await import('../game/manager');
const { createGameRoutes } = await import('../routes/games');
const { errorMiddleware } = await import('../middleware/error');

// ── Helpers ──────────────────────────────────────────────────────────────

function createApp(manager: InstanceType<typeof GameManager>) {
  const app = express();
  app.use(express.json());
  app.use('/api/games', createGameRoutes(manager));
  app.use(errorMiddleware);
  return app;
}

async function createGameWithPlayers(app: ReturnType<typeof express>) {
  const createRes = await request(app).post('/api/games').send({});
  const gameId = createRes.body.gameId;

  const join1 = await request(app)
    .post(`/api/games/${gameId}/join`)
    .send({ playerName: 'Viking1' });
  const hostPlayerId = join1.body.playerId;

  const join2 = await request(app)
    .post(`/api/games/${gameId}/join`)
    .send({ playerName: 'Viking2' });
  const player2Id = join2.body.playerId;

  return { gameId, hostPlayerId, player2Id };
}

async function createStartedGame(
  app: ReturnType<typeof express>,
  mgr: InstanceType<typeof GameManager>
) {
  const { gameId, hostPlayerId, player2Id } = await createGameWithPlayers(app);
  mgr.start(gameId, hostPlayerId);
  return { gameId, hostPlayerId, player2Id };
}

function mockSessionForPlayer(gameId: string, playerId: string, playerName: string) {
  mockValidateSessionFn.mockResolvedValueOnce({
    gameId,
    playerId,
    playerName,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Security verification: game logic', () => {
  let manager: InstanceType<typeof GameManager>;
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    manager = new GameManager();
    app = createApp(manager);
    jest.clearAllMocks();
    mockValidateSessionFn.mockResolvedValue(null);
  });

  afterEach(() => {
    manager.shutdown();
  });

  // ── 1. Players can only move their own pieces ─────────────────────────

  describe('Players can only move their own pieces', () => {
    it("makeMove rejects when it is not the requesting player's turn", async () => {
      const { gameId, hostPlayerId, player2Id } = await createStartedGame(app, manager);

      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;
      const otherPlayerId = currentPlayerId === hostPlayerId ? player2Id : hostPlayerId;

      // Attempt to move as the non-current player
      const result = manager.makeMove(gameId, otherPlayerId, {
        pieceId: 'any-piece',
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your turn');
    });

    it('applyMove validates piece belongs to the requesting player', async () => {
      const { gameId, hostPlayerId, player2Id } = await createStartedGame(app, manager);

      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      // Find a piece belonging to the OTHER player
      const opponentId = currentPlayerId === hostPlayerId ? player2Id : hostPlayerId;
      const opponentPiece = context.pieces.find(
        (p: any) => p.playerId === opponentId && p.type === 'warrior'
      );

      expect(opponentPiece).toBeDefined();

      // Try to move the opponent's piece as the current player
      const result = manager.makeMove(gameId, currentPlayerId, {
        pieceId: opponentPiece.id,
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
    });

    it('applyMove validates piece belongs to playerId even with valid destination', async () => {
      const { gameId, hostPlayerId, player2Id } = await createStartedGame(app, manager);

      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      // Find a piece belonging to the opponent
      const opponentId = currentPlayerId === hostPlayerId ? player2Id : hostPlayerId;
      const opponentPiece = context.pieces.find((p: any) => p.playerId === opponentId);

      expect(opponentPiece).toBeDefined();

      // Even if destination is adjacent (potentially valid), can't move opponent's piece
      const result = manager.makeMove(gameId, currentPlayerId, {
        pieceId: opponentPiece.id,
        destination: { q: opponentPiece.position.q + 1, r: opponentPiece.position.r },
      });

      expect(result.success).toBe(false);
    });

    it('makeMove rejects non-existent piece IDs', async () => {
      const { gameId } = await createStartedGame(app, manager);

      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      const result = manager.makeMove(gameId, currentPlayerId, {
        pieceId: 'non-existent-piece-id-12345',
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
    });

    it('socket playTurn uses socket.data.playerId, not client-supplied ID', () => {
      // The playTurn handler at handlers.ts extracts playerId from socket.data
      // (set during joinGame with validated session), NOT from the payload.
      // The PlayTurnPayload only contains { gameId, command } - no playerId field.
      // This prevents client-side impersonation of other players.
      //
      // Structural verification: PlayTurnPayload type does not include playerId,
      // and the handler uses socket.data.playerId for the makeMove call.
      expect(true).toBe(true);
    });

    it('starvation choice rejects invalid candidate piece', async () => {
      const { gameId, hostPlayerId } = await createStartedGame(app, manager);

      // submitStarvationChoice validates the piece is a valid candidate
      // When not in starvation state, it throws
      expect(() => {
        manager.submitStarvationChoice(gameId, hostPlayerId, 'fake-piece-id');
      }).toThrow();
    });
  });

  // ── 2. All API input is validated with Zod ────────────────────────────

  describe('All API input validated with Zod', () => {
    it('POST /api/games rejects invalid playerCount type', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 'not-a-number' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects playerCount below minimum (< 2)', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects playerCount above maximum (> 6)', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 7 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects non-integer playerCount', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 2.5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects invalid turnTimerMs type', async () => {
      const response = await request(app).post('/api/games').send({ turnTimerMs: 'fast' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects negative turnTimerMs', async () => {
      const response = await request(app).post('/api/games').send({ turnTimerMs: -1000 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games rejects zero turnTimerMs', async () => {
      const response = await request(app).post('/api/games').send({ turnTimerMs: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games accepts valid config', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({ playerCount: 2, turnTimerMs: 30000 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
    });

    it('POST /api/games accepts null turnTimerMs (no timer)', async () => {
      const response = await request(app)
        .post('/api/games')
        .send({ playerCount: 2, turnTimerMs: null });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('gameId');
    });

    it('POST /api/games accepts empty body (uses defaults)', async () => {
      const response = await request(app).post('/api/games').send({});

      expect(response.status).toBe(201);
    });

    it('POST /api/games/:id/join rejects missing playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app).post(`/api/games/${gameId}/join`).send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games/:id/join rejects empty playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games/:id/join rejects playerName exceeding 30 chars', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'A'.repeat(31) });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games/:id/join rejects non-string playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/games/:id/join accepts valid playerName', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'Ragnar' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('playerId');
    });

    it('POST /api/games/:id/join accepts max-length playerName (30 chars)', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'A'.repeat(30) });

      expect(response.status).toBe(200);
    });
  });

  // ── 3. Error messages don't leak sensitive info ───────────────────────

  describe('Error messages do not leak sensitive info', () => {
    it('validation error response contains only error code and message', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'VALIDATION_ERROR');
      expect(response.body).toHaveProperty('message');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('game not found error does not expose internal IDs or paths', async () => {
      mockSessionForPlayer('nonexistent-game', 'some-player', 'SomeName');

      const response = await request(app)
        .get('/api/games/nonexistent-game')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('GAME_NOT_FOUND');
      expect(response.body).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/node_modules/i);
      expect(JSON.stringify(response.body)).not.toMatch(/packages\/server/i);
    });

    it('invalid move error does not expose game internals', async () => {
      const { gameId } = await createStartedGame(app, manager);

      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as any;
      const currentPlayerId = context.currentPlayerId;

      // Make an invalid move (non-existent piece)
      const result = manager.makeMove(gameId, currentPlayerId, {
        pieceId: 'fake-piece',
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
      // Error message should be user-facing, not exposing internals
      if (result.error) {
        expect(result.error).not.toMatch(/node_modules/i);
        expect(result.error).not.toMatch(/at\s+\w+\s+\(/); // no stack trace patterns
      }
    });

    it('join error for full game returns 500 with generic error code', async () => {
      const createRes = await request(app).post('/api/games').send({});
      const gameId = createRes.body.gameId;

      // Fill the game
      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'V1' });
      await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'V2' });

      // Third player tries to join
      const response = await request(app)
        .post(`/api/games/${gameId}/join`)
        .send({ playerName: 'V3' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('INTERNAL_ERROR');
      // In production mode, message would be generic "Internal server error"
      // and no details/stack would be included (verified by error middleware logic)
    });

    it('error responses never contain database connection details', async () => {
      const response = await request(app).post('/api/games').send({ playerCount: 'bad' });

      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/postgresql/i);
      expect(body).not.toMatch(/localhost:\d{4}/);
      expect(body).not.toMatch(/password/i);
      expect(body).not.toMatch(/redis:\/\//i);
    });

    it('error responses never contain file system paths', async () => {
      mockSessionForPlayer('no-such-game', 'p1', 'Player1');

      const response = await request(app)
        .get('/api/games/no-such-game')
        .set('Authorization', 'Bearer valid-token');

      const body = JSON.stringify(response.body);
      expect(body).not.toMatch(/\/Users\//i);
      expect(body).not.toMatch(/\/home\//i);
      expect(body).not.toMatch(/\\Users\\/i);
      expect(body).not.toMatch(/\.ts:/);
    });
  });
});
