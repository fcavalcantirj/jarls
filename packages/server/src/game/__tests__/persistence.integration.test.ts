import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Pool, QueryResultRow } from 'pg';

// Use a direct pool for integration tests (bypasses the module-level pool in db/pool.ts)
const TEST_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://jarls:jarls@localhost:5432/jarls';

let pool: Pool;

const testPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 3 });

// Mock the db module to route queries through our test pool
jest.unstable_mockModule('../../db', () => ({
  query: async <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    return testPool.query<T>(text, params);
  },
}));

const { saveSnapshot, loadSnapshot, VersionConflictError, saveEvent, loadEvents } =
  await import('../persistence');

describe('persistence integration tests', () => {
  beforeAll(async () => {
    pool = testPool;
    // Ensure tables exist (migrations should have run)
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('game_snapshots', 'game_events')
       ORDER BY table_name`
    );
    const tables = result.rows.map((r) => r.table_name);
    expect(tables).toContain('game_events');
    expect(tables).toContain('game_snapshots');
  });

  afterEach(async () => {
    // Clean up test data after each test
    await pool.query(`DELETE FROM game_events WHERE game_id LIKE 'test-%'`);
    await pool.query(`DELETE FROM game_snapshots WHERE game_id LIKE 'test-%'`);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('saveSnapshot', () => {
    it('creates a new snapshot record in the database', async () => {
      const state = { phase: 'lobby', players: ['Alice', 'Bob'] };
      await saveSnapshot('test-create-1', state, 1, 'lobby');

      const result = await pool.query(`SELECT * FROM game_snapshots WHERE game_id = $1`, [
        'test-create-1',
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].game_id).toBe('test-create-1');
      expect(result.rows[0].state_snapshot).toEqual(state);
      expect(result.rows[0].version).toBe(1);
      expect(result.rows[0].status).toBe('lobby');
      expect(result.rows[0].created_at).toBeInstanceOf(Date);
      expect(result.rows[0].updated_at).toBeInstanceOf(Date);
    });

    it('updates an existing snapshot with version increment', async () => {
      const state1 = { phase: 'lobby', players: [] };
      const state2 = { phase: 'playing', players: ['Alice', 'Bob'] };

      await saveSnapshot('test-update-1', state1, 1, 'lobby');
      await saveSnapshot('test-update-1', state2, 2, 'playing');

      const result = await pool.query(`SELECT * FROM game_snapshots WHERE game_id = $1`, [
        'test-update-1',
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].state_snapshot).toEqual(state2);
      expect(result.rows[0].version).toBe(2);
      expect(result.rows[0].status).toBe('playing');
    });

    it('throws VersionConflictError on concurrent update', async () => {
      const state = { phase: 'lobby' };
      await saveSnapshot('test-conflict-1', state, 1, 'lobby');

      // First update to version 2 succeeds
      await saveSnapshot('test-conflict-1', { phase: 'playing' }, 2, 'playing');

      // Trying to update from version 1 again (stale) should fail
      await expect(
        saveSnapshot('test-conflict-1', { phase: 'stale' }, 2, 'playing')
      ).rejects.toThrow(VersionConflictError);
    });
  });

  describe('loadSnapshot', () => {
    it('returns the saved snapshot data', async () => {
      const state = { phase: 'playing', pieces: [{ id: 'p1', type: 'warrior' }] };
      await saveSnapshot('test-load-1', state, 1, 'playing');

      const snapshot = await loadSnapshot('test-load-1');

      expect(snapshot).not.toBeNull();
      expect(snapshot!.gameId).toBe('test-load-1');
      expect(snapshot!.state).toEqual(state);
      expect(snapshot!.version).toBe(1);
      expect(snapshot!.status).toBe('playing');
      expect(snapshot!.createdAt).toBeInstanceOf(Date);
      expect(snapshot!.updatedAt).toBeInstanceOf(Date);
    });

    it('returns null for non-existent game', async () => {
      const snapshot = await loadSnapshot('test-nonexistent');
      expect(snapshot).toBeNull();
    });

    it('returns updated data after version bump', async () => {
      await saveSnapshot('test-load-2', { phase: 'lobby' }, 1, 'lobby');
      await saveSnapshot('test-load-2', { phase: 'playing' }, 2, 'playing');
      await saveSnapshot('test-load-2', { phase: 'ended' }, 3, 'ended');

      const snapshot = await loadSnapshot('test-load-2');
      expect(snapshot!.version).toBe(3);
      expect(snapshot!.status).toBe('ended');
      expect(snapshot!.state).toEqual({ phase: 'ended' });
    });
  });

  describe('saveEvent and loadEvents', () => {
    it('persists events and loads them in order', async () => {
      // First create a snapshot (events have FK to game_snapshots)
      await saveSnapshot('test-events-1', { phase: 'playing' }, 1, 'playing');

      await saveEvent('test-events-1', 'MOVE', { pieceId: 'w1', from: { q: 0, r: 1 } });
      await saveEvent('test-events-1', 'PUSH', { pieceId: 'w2', direction: 3 });
      await saveEvent('test-events-1', 'ELIMINATED', { pieceId: 'w3' });

      const events = await loadEvents('test-events-1');

      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('MOVE');
      expect(events[0].eventData).toEqual({ pieceId: 'w1', from: { q: 0, r: 1 } });
      expect(events[0].gameId).toBe('test-events-1');
      expect(events[0].createdAt).toBeInstanceOf(Date);

      expect(events[1].eventType).toBe('PUSH');
      expect(events[2].eventType).toBe('ELIMINATED');

      // Verify ordering: event IDs should be ascending
      expect(events[0].eventId).toBeLessThan(events[1].eventId);
      expect(events[1].eventId).toBeLessThan(events[2].eventId);
    });

    it('returns empty array for game with no events', async () => {
      await saveSnapshot('test-events-2', { phase: 'lobby' }, 1, 'lobby');
      const events = await loadEvents('test-events-2');
      expect(events).toEqual([]);
    });

    it('saves events with default empty data', async () => {
      await saveSnapshot('test-events-3', { phase: 'playing' }, 1, 'playing');
      await saveEvent('test-events-3', 'TURN_SKIPPED');

      const events = await loadEvents('test-events-3');
      expect(events).toHaveLength(1);
      expect(events[0].eventData).toEqual({});
    });

    it('isolates events between different games', async () => {
      await saveSnapshot('test-events-4a', { phase: 'playing' }, 1, 'playing');
      await saveSnapshot('test-events-4b', { phase: 'playing' }, 1, 'playing');

      await saveEvent('test-events-4a', 'MOVE', { game: 'a' });
      await saveEvent('test-events-4b', 'PUSH', { game: 'b' });
      await saveEvent('test-events-4a', 'ELIMINATED', { game: 'a' });

      const eventsA = await loadEvents('test-events-4a');
      const eventsB = await loadEvents('test-events-4b');

      expect(eventsA).toHaveLength(2);
      expect(eventsB).toHaveLength(1);
      expect(eventsA[0].eventType).toBe('MOVE');
      expect(eventsA[1].eventType).toBe('ELIMINATED');
      expect(eventsB[0].eventType).toBe('PUSH');
    });
  });
});
