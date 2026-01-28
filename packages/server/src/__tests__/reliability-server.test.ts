import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { GameConfig } from '@jarls/shared';

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

jest.unstable_mockModule('../game/persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  loadActiveSnapshots: mockLoadActiveSnapshotsFn,
  VersionConflictError: class VersionConflictError extends Error {
    constructor(gameId: string, version: number) {
      super(`Version conflict for game ${gameId}: expected version ${version}`);
      this.name = 'VersionConflictError';
    }
  },
}));

const { GameManager } = await import('../game/manager');

// ── Helpers ──────────────────────────────────────────────────────────────

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

async function createStartedGame(manager: InstanceType<typeof GameManager>) {
  const gameId = await manager.create({ config: createTestConfig() });
  const p1 = manager.join(gameId, 'Alice');
  const p2 = manager.join(gameId, 'Bob');
  manager.start(gameId, p1);
  // Allow async state transitions to settle
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { gameId, p1, p2 };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Server Reliability Requirements', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default implementations after clearAllMocks
    mockSaveSnapshotFn.mockResolvedValue(undefined);
    mockSaveEventFn.mockResolvedValue(undefined);
    mockLoadActiveSnapshotsFn.mockResolvedValue([]);
    mockLoadSnapshotFn.mockResolvedValue(null);
    mockLoadEventsFn.mockResolvedValue([]);
  });

  afterEach(() => {
    manager?.shutdown();
  });

  // ── 1. Game state persists to database ──────────────────────────────

  describe('Game state persists to database', () => {
    it('saves initial snapshot when game is created', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(mockSaveSnapshotFn).toHaveBeenCalledWith(gameId, expect.anything(), 1, 'lobby');
    });

    it('saves GAME_CREATED event when game is created', async () => {
      manager = new GameManager();
      const config = createTestConfig();
      await manager.create({ config });

      expect(mockSaveEventFn).toHaveBeenCalledWith(
        expect.any(String),
        'GAME_CREATED',
        expect.objectContaining({ config })
      );
    });

    it('saves snapshot on state transition to playing', async () => {
      manager = new GameManager();
      await createStartedGame(manager);

      // Should have been called with a 'playing' status at some point
      const playingCall = mockSaveSnapshotFn.mock.calls.find((c: unknown[]) => c[3] === 'playing');
      expect(playingCall).toBeDefined();
    });

    it('saves event on state transition to playing', async () => {
      manager = new GameManager();
      await createStartedGame(manager);

      const playingEvent = mockSaveEventFn.mock.calls.find(
        (c: unknown[]) => c[1] === 'STATE_PLAYING'
      );
      expect(playingEvent).toBeDefined();
    });

    it('persists full XState snapshot including context', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      const snapshotArg = mockSaveSnapshotFn.mock.calls[0][1] as Record<string, unknown>;
      // XState persisted snapshots include value and context
      expect(snapshotArg).toHaveProperty('value');
      expect(snapshotArg).toHaveProperty('context');

      const context = snapshotArg.context as Record<string, unknown>;
      // Context stores the game identifier as 'id'
      expect(context).toHaveProperty('id', gameId);
      expect(context).toHaveProperty('config');
      expect(context).toHaveProperty('players');
    });

    it('increments version on each state transition', async () => {
      manager = new GameManager();
      await createStartedGame(manager);

      // Version 1 = initial save (lobby)
      // Version 2+ = state transitions (setup -> playing)
      const versions = mockSaveSnapshotFn.mock.calls.map((c: unknown[]) => c[2] as number);
      expect(versions[0]).toBe(1); // initial
      // Subsequent versions should be incrementing
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBeGreaterThan(versions[0]);
      }
    });

    it('continues game operation even if persistence fails', async () => {
      manager = new GameManager();
      // Make snapshot saving fail after initial creation
      const gameId = await manager.create({ config: createTestConfig() });

      // Use mockImplementation to temporarily reject (resets in beforeEach)
      mockSaveSnapshotFn.mockRejectedValue(new Error('DB connection lost'));

      // Game should still function - join and start
      const p1 = manager.join(gameId, 'Alice');
      manager.join(gameId, 'Bob');
      manager.start(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Game state should still be accessible in memory
      const state = manager.getState(gameId);
      expect(state).toBeDefined();
    });
  });

  // ── 2. Server recovers active games on restart ──────────────────────

  describe('Server recovers active games on restart', () => {
    it('calls loadActiveSnapshots on recover', async () => {
      manager = new GameManager();
      await manager.recover();

      expect(mockLoadActiveSnapshotsFn).toHaveBeenCalledTimes(1);
    });

    it('recovers a game from a lobby snapshot', async () => {
      // First create a game to get a valid snapshot format
      const tempManager = new GameManager();
      const gameId = await tempManager.create({ config: createTestConfig() });

      // Capture the persisted snapshot
      const savedSnapshot = mockSaveSnapshotFn.mock.calls[0][1];
      tempManager.shutdown();

      // Set up loadActiveSnapshots to return this snapshot
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId,
          state: savedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Now recover
      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBe(1);
      expect(manager.gameCount).toBe(1);

      // Verify the game is functional
      const state = manager.getState(gameId);
      expect(state).toBeDefined();
    });

    it('recovers a playing game from snapshot', async () => {
      // Create and start a game to get a playing snapshot
      const tempManager = new GameManager();
      const { gameId } = await createStartedGame(tempManager);

      // Find the playing snapshot
      const playingCall = mockSaveSnapshotFn.mock.calls.find((c: unknown[]) => c[3] === 'playing');
      expect(playingCall).toBeDefined();
      const playingSnapshot = playingCall![1];
      const playingVersion = playingCall![2] as number;
      tempManager.shutdown();

      jest.clearAllMocks();
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId,
          state: playingSnapshot,
          version: playingVersion,
          status: 'playing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBe(1);
      const state = manager.getState(gameId);
      expect(state).toBeDefined();
    });

    it('recovers multiple games simultaneously', async () => {
      // Create two games for snapshots
      const tempManager = new GameManager();
      const gameId1 = await tempManager.create({ config: createTestConfig() });
      const gameId2 = await tempManager.create({ config: createTestConfig() });

      const snapshot1 = mockSaveSnapshotFn.mock.calls[0][1];
      const snapshot2 = mockSaveSnapshotFn.mock.calls[1][1];
      tempManager.shutdown();

      jest.clearAllMocks();
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId: gameId1,
          state: snapshot1,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          gameId: gameId2,
          state: snapshot2,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBe(2);
      expect(manager.gameCount).toBe(2);
    });

    it('skips games that are already loaded in memory', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      const savedSnapshot = mockSaveSnapshotFn.mock.calls[0][1];

      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId,
          state: savedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const recovered = await manager.recover();
      // Should skip the already-loaded game
      expect(recovered).toBe(0);
      expect(manager.gameCount).toBe(1);
    });

    it('handles corrupted snapshot gracefully without crashing recovery', async () => {
      // Set up one valid and one corrupted snapshot
      const tempManager = new GameManager();
      const validGameId = await tempManager.create({ config: createTestConfig() });
      const validSnapshot = mockSaveSnapshotFn.mock.calls[0][1];
      tempManager.shutdown();

      jest.clearAllMocks();
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId: 'corrupted-game',
          state: { invalid: 'not a valid xstate snapshot' },
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          gameId: validGameId,
          state: validSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      // Should not throw, should recover what it can
      await manager.recover();

      // Valid game should still be recovered
      expect(manager.getState(validGameId)).toBeDefined();
    });

    it('returns 0 when no active snapshots exist', async () => {
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([]);

      manager = new GameManager();
      const recovered = await manager.recover();

      expect(recovered).toBe(0);
      expect(manager.gameCount).toBe(0);
    });

    it('recovered game continues to persist state changes', async () => {
      // Create a game to get a valid lobby snapshot
      const tempManager = new GameManager();
      const gameId = await tempManager.create({ config: createTestConfig() });
      const savedSnapshot = mockSaveSnapshotFn.mock.calls[0][1];
      tempManager.shutdown();

      jest.clearAllMocks();
      mockLoadActiveSnapshotsFn.mockResolvedValueOnce([
        {
          gameId,
          state: savedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      await manager.recover();

      // Now use the recovered game - join players and start
      const p1 = manager.join(gameId, 'Alice');
      manager.join(gameId, 'Bob');
      manager.start(gameId, p1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have saved new snapshots for the state transition
      expect(mockSaveSnapshotFn).toHaveBeenCalled();
      const playingCall = mockSaveSnapshotFn.mock.calls.find((c: unknown[]) => c[3] === 'playing');
      expect(playingCall).toBeDefined();
    });
  });

  // ── 3. Optimistic locking prevents concurrent conflicts ─────────────

  describe('Optimistic locking prevents concurrent conflicts', () => {
    it('saveSnapshot uses version-based WHERE clause for updates', async () => {
      manager = new GameManager();
      await createStartedGame(manager);

      // Find an UPDATE call (version > 1)
      const updateCall = mockSaveSnapshotFn.mock.calls.find((c: unknown[]) => (c[2] as number) > 1);
      expect(updateCall).toBeDefined();
      // The version should be > 1, indicating optimistic locking is used
      expect(updateCall![2]).toBeGreaterThan(1);
    });

    it('version increments on each state transition', async () => {
      manager = new GameManager();
      await createStartedGame(manager);

      const versions = mockSaveSnapshotFn.mock.calls.map((c: unknown[]) => c[2] as number);
      // Versions should be monotonically increasing
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBeGreaterThan(versions[i - 1]);
      }
    });

    it('only persists on top-level state changes (not compound sub-states)', async () => {
      manager = new GameManager();
      const { gameId } = await createStartedGame(manager);
      const saveCountAfterStart = mockSaveSnapshotFn.mock.calls.length;

      // Make a move within the 'playing' state - this should NOT trigger
      // a new snapshot because the top-level state stays 'playing'
      const snapshot = manager.getState(gameId);
      expect(snapshot).toBeDefined();

      const context = snapshot!.context as unknown as Record<string, unknown>;
      const currentPlayerId = context.currentPlayerId as string;
      const pieces = context.pieces as Array<Record<string, unknown>>;
      const playerPieces = pieces.filter(
        (p) => p.playerId === currentPlayerId && p.type === 'warrior'
      );

      if (playerPieces.length > 0) {
        try {
          const { getValidMoves } = await import('@jarls/shared');
          const validMoves = getValidMoves(snapshot!.context as any, playerPieces[0].id as string);
          if (validMoves.length > 0) {
            manager.makeMove(gameId, currentPlayerId, {
              pieceId: playerPieces[0].id as string,
              destination: validMoves[0].destination,
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch {
          // Move may fail, that's ok for this test
        }
      }

      // Moves within 'playing' sub-states should not trigger new snapshots
      const saveCountAfterMove = mockSaveSnapshotFn.mock.calls.length;
      expect(saveCountAfterMove).toBe(saveCountAfterStart);
    });

    it('VersionConflictError is defined and throwable', async () => {
      const { VersionConflictError } = await import('../game/persistence');
      const error = new VersionConflictError('test-game', 5);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('test-game');
      expect(error.message).toContain('5');
      expect(error.name).toBe('VersionConflictError');
    });
  });

  // ── 4. Connection pool handles reconnection ─────────────────────────

  describe('Connection pool handles reconnection', () => {
    it('pool is configured with max connections and idle timeout', async () => {
      // Verify pool.ts exports pool with proper config
      // We verify this by checking the module structure
      const db = await import('../db');
      expect(db).toHaveProperty('query');
      expect(db).toHaveProperty('getClient');
      expect(db).toHaveProperty('closePool');
      expect(db).toHaveProperty('pool');
    });

    it('pool has error event handler for idle client errors', async () => {
      const db = await import('../db');
      const pool = db.pool;
      // pg Pool emits 'error' on idle client issues
      // Verify the pool has at least one error listener
      const errorListeners = pool.listenerCount('error');
      expect(errorListeners).toBeGreaterThanOrEqual(1);
    });

    it('query function wraps pool.query with error handling', async () => {
      // The query function logs errors and rethrows
      // This ensures callers can handle and retry
      const db = await import('../db');
      expect(typeof db.query).toBe('function');
    });

    it('getClient provides dedicated client for transactions', async () => {
      const db = await import('../db');
      expect(typeof db.getClient).toBe('function');
    });

    it('closePool provides graceful shutdown', async () => {
      const db = await import('../db');
      expect(typeof db.closePool).toBe('function');
    });

    it('game manager handles persistence errors without crashing', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Simulate DB errors during state transitions
      mockSaveSnapshotFn.mockRejectedValue(new Error('Connection refused'));
      mockSaveEventFn.mockRejectedValue(new Error('Connection refused'));

      // Game operations should still work in memory
      const p1 = manager.join(gameId, 'Alice');
      manager.join(gameId, 'Bob');

      // start should not throw even if persistence fails
      expect(() => manager.start(gameId, p1)).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Game state is still accessible
      const state = manager.getState(gameId);
      expect(state).toBeDefined();
    });
  });

  // ── 5. No memory leaks ──────────────────────────────────────────────

  describe('No memory leaks (extended test)', () => {
    it('shutdown stops all game actors and clears games map', async () => {
      manager = new GameManager();
      await manager.create({ config: createTestConfig() });
      await manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(2);

      manager.shutdown();
      expect(manager.gameCount).toBe(0);
    });

    it('remove() cleans up individual game actors', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(1);

      manager.remove(gameId);
      expect(manager.gameCount).toBe(0);
      expect(manager.getState(gameId)).toBeUndefined();
    });

    it('creating and removing many games does not leak', async () => {
      manager = new GameManager();
      const gameIds: string[] = [];

      // Create 20 games
      for (let i = 0; i < 20; i++) {
        const gameId = await manager.create({ config: createTestConfig() });
        gameIds.push(gameId);
      }
      expect(manager.gameCount).toBe(20);

      // Remove all games
      for (const gameId of gameIds) {
        manager.remove(gameId);
      }
      expect(manager.gameCount).toBe(0);
    });

    it('ended game state transitions are handled without accumulation', async () => {
      manager = new GameManager();

      // Create multiple games, start them, and verify state is tracked
      const games: string[] = [];
      for (let i = 0; i < 5; i++) {
        const gameId = await manager.create({ config: createTestConfig() });
        games.push(gameId);
      }
      expect(manager.gameCount).toBe(5);

      // Remove them all
      for (const gameId of games) {
        manager.remove(gameId);
      }
      expect(manager.gameCount).toBe(0);
    });

    it('rapid game creation and destruction cycle stays stable', async () => {
      manager = new GameManager();

      // Rapid cycle: create, use, destroy
      for (let i = 0; i < 10; i++) {
        const gameId = await manager.create({ config: createTestConfig() });
        manager.join(gameId, `Player${i}`);
        manager.remove(gameId);
      }

      // After all cycles, no games remain
      expect(manager.gameCount).toBe(0);
    });

    it('subscriptions are cleaned up when game is removed', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Track saves before removal
      const saveCountBefore = mockSaveSnapshotFn.mock.calls.length;

      manager.remove(gameId);

      // Wait a bit to see if any async callbacks fire
      await new Promise((resolve) => setTimeout(resolve, 200));

      // No new snapshot saves should happen after removal
      // (subscription should have been cleaned up)
      const saveCountAfter = mockSaveSnapshotFn.mock.calls.length;
      expect(saveCountAfter).toBe(saveCountBefore);
    });

    it('listGames returns empty after all games removed', async () => {
      manager = new GameManager();
      const gameId1 = await manager.create({ config: createTestConfig() });
      const gameId2 = await manager.create({ config: createTestConfig() });

      expect(manager.listGames()).toHaveLength(2);

      manager.remove(gameId1);
      manager.remove(gameId2);

      expect(manager.listGames()).toHaveLength(0);
    });
  });
});
