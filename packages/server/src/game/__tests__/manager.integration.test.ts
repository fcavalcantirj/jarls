import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Pool, QueryResultRow } from 'pg';
import type { GameConfig } from '@jarls/shared';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GameManager: any, loadSnapshot: any, loadEvents: (...args: any[]) => Promise<any[]>;

beforeAll(async () => {
  ({ GameManager } = await import('../manager'));
  ({ loadSnapshot, loadEvents } = await import('../persistence'));
});

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

describe('GameManager integration tests', () => {
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
    // Shutdown the manager to stop all actors
    manager?.shutdown();

    // Clean up test data
    await testPool.query(`DELETE FROM game_events WHERE game_id LIKE 'test-%'`);
    await testPool.query(`DELETE FROM game_snapshots WHERE game_id LIKE 'test-%'`);

    // Also clean up any dynamically generated IDs by checking for recently created rows
    // The GameManager generates random IDs, so we clean up by finding snapshots
    // created in the last minute
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

  describe('create game persists to DB', () => {
    it('saves initial snapshot to database on game creation', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Verify the snapshot was persisted
      const snapshot = await loadSnapshot(gameId);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.gameId).toBe(gameId);
      expect(snapshot!.version).toBe(1);
      expect(snapshot!.status).toBe('lobby');
      expect(snapshot!.createdAt).toBeInstanceOf(Date);
    });

    it('saves GAME_CREATED event to database', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      const events = await loadEvents(gameId);
      expect(events.length).toBeGreaterThanOrEqual(1);

      const createdEvent = events.find((e) => e.eventType === 'GAME_CREATED');
      expect(createdEvent).toBeDefined();
      expect(createdEvent!.gameId).toBe(gameId);
      expect(createdEvent!.eventData).toEqual(
        expect.objectContaining({
          config: expect.objectContaining({
            playerCount: 2,
            boardRadius: 3,
          }),
        })
      );
    });

    it('persists state snapshot as valid XState persisted snapshot', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      const snapshot = await loadSnapshot(gameId);
      expect(snapshot).not.toBeNull();

      // The persisted snapshot should contain XState structure
      const state = snapshot!.state as Record<string, unknown>;
      expect(state).toHaveProperty('value');
      expect(state).toHaveProperty('context');

      // The value should be 'lobby' (initial state)
      expect(state.value).toBe('lobby');

      // The context should contain game configuration
      const context = state.context as Record<string, unknown>;
      expect(context).toHaveProperty('config');
      expect(context).toHaveProperty('players');
      expect(context).toHaveProperty('phase');
    });

    it('persists state transitions when game state changes', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Send events to transition the game through states
      const actor = manager.getActor(gameId);
      expect(actor).toBeDefined();

      // Join two players
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });

      // Start the game (triggers lobby -> setup -> playing)
      actor!.send({ type: 'START_GAME', playerId: 'p1' });

      // Give fire-and-forget persistence a moment to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify the snapshot was updated to 'playing' status
      const snapshot = await loadSnapshot(gameId);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.version).toBeGreaterThan(1);
      expect(snapshot!.status).toBe('playing');

      // Verify state transition events were saved
      const events = await loadEvents(gameId);
      const stateEvents = events.filter((e) => e.eventType.startsWith('STATE_'));
      expect(stateEvents.length).toBeGreaterThanOrEqual(1);

      // Should have a STATE_PLAYING event
      const playingEvent = events.find((e) => e.eventType === 'STATE_PLAYING');
      expect(playingEvent).toBeDefined();
    });

    it('creates multiple games with independent snapshots', async () => {
      manager = new GameManager();
      const gameId1 = await manager.create({ config: createTestConfig() });
      const gameId2 = await manager.create({ config: createTestConfig() });

      expect(gameId1).not.toBe(gameId2);

      const snapshot1 = await loadSnapshot(gameId1);
      const snapshot2 = await loadSnapshot(gameId2);

      expect(snapshot1).not.toBeNull();
      expect(snapshot2).not.toBeNull();
      expect(snapshot1!.gameId).toBe(gameId1);
      expect(snapshot2!.gameId).toBe(gameId2);
    });
  });

  describe('recover loads games from DB', () => {
    it('recovers a lobby game from database', async () => {
      // Create a game with one manager
      const manager1 = new GameManager();
      const gameId = await manager1.create({ config: createTestConfig() });

      // Join a player before shutting down
      const actor = manager1.getActor(gameId);
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      await new Promise((resolve) => setTimeout(resolve, 100));

      manager1.shutdown();

      // Create a new manager and recover
      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBeGreaterThanOrEqual(1);
      expect(manager.gameCount).toBeGreaterThanOrEqual(1);

      // Verify the recovered game state
      const state = manager.getState(gameId);
      expect(state).toBeDefined();

      const context = state!.context;
      expect(context.id).toBe(gameId);
      expect(context.config.playerCount).toBe(2);
    });

    it('recovers a playing game from database', async () => {
      // Create and start a game
      const manager1 = new GameManager();
      const gameId = await manager1.create({ config: createTestConfig() });

      const actor = manager1.getActor(gameId);
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor!.send({ type: 'START_GAME', playerId: 'p1' });

      // Wait for fire-and-forget persistence
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify it transitioned to playing
      const playingSnapshot = await loadSnapshot(gameId);
      expect(playingSnapshot!.status).toBe('playing');

      manager1.shutdown();

      // Recover with a new manager
      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBeGreaterThanOrEqual(1);

      const state = manager.getState(gameId);
      expect(state).toBeDefined();

      // Verify game is in playing state with correct data
      const value = typeof state!.value === 'string' ? state!.value : Object.keys(state!.value)[0];
      expect(value).toBe('playing');
      expect(state!.context.players).toHaveLength(2);
      expect(state!.context.pieces.length).toBeGreaterThan(0);
    });

    it('does not recover ended games', async () => {
      // Manually insert an ended game snapshot into DB
      await testPool.query(
        `INSERT INTO game_snapshots (game_id, state_snapshot, version, status)
         VALUES ($1, $2, $3, $4)`,
        [
          'test-ended-game',
          JSON.stringify({ value: 'ended', context: { config: createTestConfig() } }),
          1,
          'ended',
        ]
      );

      manager = new GameManager();
      await manager.recover();

      // The ended game should not be recovered
      expect(manager.getState('test-ended-game')).toBeUndefined();
    });

    it('recovered game actor responds to events', async () => {
      // Create a lobby game
      const manager1 = new GameManager();
      const gameId = await manager1.create({ config: createTestConfig() });
      manager1.shutdown();

      // Recover and interact with the game
      manager = new GameManager();
      await manager.recover();

      const actor = manager.getActor(gameId);
      expect(actor).toBeDefined();

      // The recovered actor should accept events
      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });

      const state = manager.getState(gameId);
      expect(state!.context.players).toHaveLength(1);
      expect(state!.context.players[0].name).toBe('Alice');
    });

    it('skips games already in memory during recover', async () => {
      manager = new GameManager();
      await manager.create({ config: createTestConfig() });

      // The game is already in memory from create()
      const countBefore = manager.gameCount;

      // Recover should skip the already-loaded game
      await manager.recover();

      // The game count should not increase for the already-loaded game
      expect(manager.gameCount).toBe(countBefore);
    });
  });
});
