import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Pool, QueryResultRow } from 'pg';
import type { GameConfig } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { GameMachineContext } from '../types';

// Use a direct pool for integration tests (bypasses the module-level pool in db/pool.ts)
const TEST_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://jarls:jarls@localhost:5432/jarls';

const testPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 3 });

// Mock the db module to route queries through our test pool
jest.unstable_mockModule('../../db', () => ({
  query: async <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    return testPool.query<T>(text, params);
  },
}));

const { GameManager } = await import('../manager');
const { loadSnapshot, loadEvents } = await import('../persistence');

function createTestConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    playerCount: 2,
    boardRadius: 3,
    shieldCount: 5,
    warriorCount: 5,
    turnTimerMs: null,
    ...overrides,
  };
}

/**
 * Helper: create a game, join 2 players via actor events, and start it.
 * Uses direct actor sends (same as existing integration tests).
 */
async function createStartedGame(manager: InstanceType<typeof GameManager>) {
  const gameId = await manager.create({ config: createTestConfig() });
  const actor = manager.getActor(gameId);
  expect(actor).toBeDefined();

  actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor!.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor!.send({ type: 'START_GAME', playerId: 'p1' });

  // Wait for fire-and-forget persistence to complete
  await new Promise((resolve) => setTimeout(resolve, 200));

  return { gameId, p1: 'p1', p2: 'p2' };
}

describe('GameManager disconnection/reconnection integration tests', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeAll(async () => {
    // Ensure tables exist (migrations should have run)
    const result = await testPool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('game_snapshots', 'game_events')
       ORDER BY table_name`
    );
    const tables = result.rows.map((r) => r.table_name);
    expect(tables).toContain('game_events');
    expect(tables).toContain('game_snapshots');
  });

  afterEach(async () => {
    manager?.shutdown();

    // Clean up test data
    await testPool.query(`DELETE FROM game_events WHERE game_id LIKE 'test-%'`);
    await testPool.query(`DELETE FROM game_snapshots WHERE game_id LIKE 'test-%'`);

    // Clean up dynamically generated IDs
    await testPool.query(
      `DELETE FROM game_events WHERE game_id IN (
        SELECT game_id FROM game_snapshots WHERE created_at > now() - interval '1 minute'
      )`
    );
    await testPool.query(
      `DELETE FROM game_snapshots WHERE created_at > now() - interval '1 minute'`
    );
  });

  afterAll(async () => {
    await testPool.end();
  });

  describe('disconnect persists to database', () => {
    it('persists paused state when current player disconnects', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      // Verify game is in playing state
      const beforeSnapshot = await loadSnapshot(gameId);
      expect(beforeSnapshot!.status).toBe('playing');

      // Disconnect current player
      manager.onDisconnect(gameId, p1);

      // Wait for persistence
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify paused state persisted
      const afterSnapshot = await loadSnapshot(gameId);
      expect(afterSnapshot).not.toBeNull();
      expect(afterSnapshot!.status).toBe('paused');
      expect(afterSnapshot!.version).toBeGreaterThan(beforeSnapshot!.version);
    });

    it('saves STATE_PAUSED event on disconnect', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const events = await loadEvents(gameId);
      const pausedEvent = events.find((e) => e.eventType === 'STATE_PAUSED');
      expect(pausedEvent).toBeDefined();
      expect(pausedEvent!.eventData).toEqual(
        expect.objectContaining({
          fromState: 'playing',
          toState: 'paused',
        })
      );
    });

    it('persists playing state after reconnect', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      // Disconnect then reconnect
      manager.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager.onReconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify state returned to playing
      const snapshot = await loadSnapshot(gameId);
      expect(snapshot!.status).toBe('playing');
    });

    it('saves STATE_PLAYING event after reconnect', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager.onReconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const events = await loadEvents(gameId);
      // After disconnect/reconnect, we should see paused -> playing transition
      const playingEvents = events.filter((e) => e.eventType === 'STATE_PLAYING');
      // At least 2: one from start, one from reconnect
      expect(playingEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('recover paused games from database', () => {
    it('recovers a paused game from database', async () => {
      // Create, start, then disconnect
      const manager1 = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager1);

      manager1.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify paused state persisted
      const pausedSnapshot = await loadSnapshot(gameId);
      expect(pausedSnapshot!.status).toBe('paused');

      manager1.shutdown();

      // Recover with new manager
      manager = new GameManager();
      const recovered = await manager.recover();
      expect(recovered).toBeGreaterThanOrEqual(1);

      // Verify recovered game is in paused state
      const state = manager.getState(gameId);
      expect(state).toBeDefined();
      expect(state!.value).toBe('paused');
    });

    it('recovered paused game can accept reconnection', async () => {
      const manager1 = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager1);

      manager1.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager1.shutdown();

      // Recover with new manager
      manager = new GameManager();
      await manager.recover();

      // Reconnect the player on the recovered manager
      manager.onReconnect(gameId, p1);

      const state = manager.getState(gameId);
      expect(state!.value).toEqual({ playing: 'awaitingMove' });
    });

    it('recovered game preserves player data through disconnect cycle', async () => {
      const manager1 = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager1);

      // Record state before disconnect
      const beforeState = manager1.getState(gameId);
      const beforeCtx = beforeState!.context as GameMachineContext;
      const pieceCount = beforeCtx.pieces.length;
      const playerCount = beforeCtx.players.length;

      manager1.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager1.shutdown();

      // Recover and reconnect
      manager = new GameManager();
      await manager.recover();
      manager.onReconnect(gameId, p1);

      // Verify data preserved
      const afterState = manager.getState(gameId);
      const afterCtx = afterState!.context as GameMachineContext;
      expect(afterCtx.players.length).toBe(playerCount);
      expect(afterCtx.pieces.length).toBe(pieceCount);
    });

    it('recovered game allows gameplay after reconnection', async () => {
      const manager1 = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager1);

      manager1.onDisconnect(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 200));

      manager1.shutdown();

      // Recover and reconnect
      manager = new GameManager();
      await manager.recover();
      manager.onReconnect(gameId, p1);

      // Verify gameplay works: find and make a move
      const state = manager.getState(gameId);
      const context = state!.context as GameMachineContext;
      const currentPlayerId = context.currentPlayerId!;
      expect(currentPlayerId).toBeDefined();
      const playerPieces = context.pieces.filter((p) => p.playerId === currentPlayerId);

      let moved = false;
      for (const piece of playerPieces) {
        const moves = getValidMoves(context, piece.id);
        if (moves.length > 0) {
          const actor = manager.getActor(gameId);
          actor!.send({
            type: 'MAKE_MOVE',
            playerId: currentPlayerId,
            command: {
              pieceId: piece.id,
              destination: moves[0].destination,
            },
          });
          moved = true;
          break;
        }
      }

      expect(moved).toBe(true);
    });
  });
});
