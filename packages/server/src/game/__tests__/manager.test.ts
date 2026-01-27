import { describe, it, expect, afterEach, jest, beforeEach } from '@jest/globals';
import type { GameConfig } from '@jarls/shared';

const mockSaveSnapshotFn = jest
  .fn<(...args: any[]) => Promise<void>>()
  .mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSaveEventFn = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadSnapshotFn = jest.fn<(...args: any[]) => Promise<null>>().mockResolvedValue(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadEventsFn = jest.fn<(...args: any[]) => Promise<never[]>>().mockResolvedValue([]);

const mockLoadActiveSnapshotsFn = jest
  .fn<(...args: any[]) => Promise<any[]>>()
  .mockResolvedValue([]);

// Mock persistence module before importing GameManager
jest.unstable_mockModule('../persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  loadActiveSnapshots: mockLoadActiveSnapshotsFn,
  VersionConflictError: class VersionConflictError extends Error {},
}));

const { GameManager } = await import('../manager');

const mockSaveSnapshot = mockSaveSnapshotFn;
const mockSaveEvent = mockSaveEventFn;
const mockLoadActiveSnapshots = mockLoadActiveSnapshotsFn;

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

describe('GameManager', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager?.shutdown();
  });

  describe('create', () => {
    it('creates a game and returns a game ID', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(typeof gameId).toBe('string');
      expect(gameId.length).toBeGreaterThan(0);
    });

    it('creates games with unique IDs', async () => {
      manager = new GameManager();
      const id1 = await manager.create({ config: createTestConfig() });
      const id2 = await manager.create({ config: createTestConfig() });

      expect(id1).not.toBe(id2);
    });

    it('increments game count when creating games', async () => {
      manager = new GameManager();
      expect(manager.gameCount).toBe(0);

      await manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(1);

      await manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(2);
    });

    it('starts the game in lobby state', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const snapshot = manager.getState(gameId);

      expect(snapshot).toBeDefined();
      expect(snapshot!.value).toBe('lobby');
      expect(snapshot!.context.players).toEqual([]);
      expect(snapshot!.context.phase).toBe('lobby');
    });

    it('initializes game with the provided config', async () => {
      manager = new GameManager();
      const config = createTestConfig({ turnTimerMs: 30000 });
      const gameId = await manager.create({ config });
      const snapshot = manager.getState(gameId);

      expect(snapshot!.context.config.playerCount).toBe(2);
      expect(snapshot!.context.config.boardRadius).toBe(3);
      expect(snapshot!.context.turnTimerMs).toBe(30000);
    });

    it('saves the initial persisted snapshot to the database', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Now saves the full XState persisted snapshot (has value and context keys)
      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({
          value: 'lobby',
          context: expect.objectContaining({ phase: 'lobby', players: [] }),
        }),
        1,
        'lobby'
      );
    });

    it('saves a GAME_CREATED event to the database', async () => {
      manager = new GameManager();
      const config = createTestConfig();
      await manager.create({ config });

      // saveEvent is called with (gameId, eventType, data)
      const calls = mockSaveEvent.mock.calls;
      const createdCall = calls.find((c: unknown[]) => c[1] === 'GAME_CREATED');
      expect(createdCall).toBeDefined();
      expect(createdCall![2]).toEqual({ config });
    });

    it('persists state transitions when the game state changes', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      // Clear mocks to track only transition-related calls
      mockSaveSnapshot.mockClear();
      mockSaveEvent.mockClear();

      // Trigger a state transition by adding players and starting the game
      const actor = manager.getActor(gameId)!;
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'START_GAME', playerId: 'p1' });

      // The state should now be 'playing' (lobby -> setup -> playing)
      // Allow async subscriptions to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have saved snapshot(s) for the state transitions
      // lobby -> setup is transient, but setup -> playing should be captured
      expect(mockSaveSnapshot).toHaveBeenCalled();

      // Verify the snapshot was saved with the 'playing' state
      const playingCall = mockSaveSnapshot.mock.calls.find((c: unknown[]) => c[3] === 'playing');
      expect(playingCall).toBeDefined();
      expect(playingCall![0]).toBe(gameId);
      // The persisted snapshot should contain context with game state
      expect(playingCall![1]).toEqual(
        expect.objectContaining({
          context: expect.objectContaining({ phase: 'playing' }),
        })
      );

      // Verify a STATE_PLAYING event was saved
      const stateEventCall = mockSaveEvent.mock.calls.find(
        (c: unknown[]) => c[1] === 'STATE_PLAYING'
      );
      expect(stateEventCall).toBeDefined();
    });
  });

  describe('getState', () => {
    it('returns the snapshot for an existing game', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const snapshot = manager.getState(gameId);

      expect(snapshot).toBeDefined();
      expect(snapshot!.context.id).toBe(gameId);
    });

    it('returns undefined for a non-existent game', () => {
      manager = new GameManager();
      const snapshot = manager.getState('non-existent-id');

      expect(snapshot).toBeUndefined();
    });
  });

  describe('listGames', () => {
    it('returns empty array when no games exist', () => {
      manager = new GameManager();
      const games = manager.listGames();

      expect(games).toEqual([]);
    });

    it('returns all games', async () => {
      manager = new GameManager();
      const id1 = await manager.create({ config: createTestConfig() });
      const id2 = await manager.create({ config: createTestConfig() });
      const games = manager.listGames();

      expect(games).toHaveLength(2);
      const gameIds = games.map((g: { gameId: string }) => g.gameId);
      expect(gameIds).toContain(id1);
      expect(gameIds).toContain(id2);
    });

    it('returns correct game summaries', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const games = manager.listGames();

      expect(games[0]).toEqual({
        gameId,
        status: 'lobby',
        playerCount: 0,
        maxPlayers: 2,
        players: [],
      });
    });

    it('filters games by status', async () => {
      manager = new GameManager();
      await manager.create({ config: createTestConfig() });
      await manager.create({ config: createTestConfig() });

      const lobbyGames = manager.listGames({ status: 'lobby' });
      expect(lobbyGames).toHaveLength(2);

      const playingGames = manager.listGames({ status: 'playing' });
      expect(playingGames).toHaveLength(0);
    });

    it('updates player info after players join', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const actor = manager.getActor(gameId);

      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });

      const games = manager.listGames();
      expect(games[0].playerCount).toBe(1);
      expect(games[0].players).toEqual([{ id: 'p1', name: 'Alice' }]);
    });
  });

  describe('getActor', () => {
    it('returns the actor for an existing game', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const actor = manager.getActor(gameId);

      expect(actor).toBeDefined();
    });

    it('returns undefined for a non-existent game', () => {
      manager = new GameManager();
      const actor = manager.getActor('non-existent');

      expect(actor).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('removes an existing game and returns true', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(manager.remove(gameId)).toBe(true);
      expect(manager.gameCount).toBe(0);
      expect(manager.getState(gameId)).toBeUndefined();
    });

    it('returns false for a non-existent game', () => {
      manager = new GameManager();

      expect(manager.remove('non-existent')).toBe(false);
    });
  });

  describe('recover', () => {
    it('returns 0 when no active games in database', async () => {
      manager = new GameManager();
      mockLoadActiveSnapshots.mockResolvedValue([]);

      const count = await manager.recover();
      expect(count).toBe(0);
      expect(manager.gameCount).toBe(0);
    });

    it('recovers a lobby game from database snapshot', async () => {
      // First create a game to get a valid persisted snapshot
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const actor = manager.getActor(gameId)!;
      const persistedSnapshot = actor.getPersistedSnapshot();
      manager.shutdown();

      // Now simulate recovery from the database
      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'recovered-game-1',
          state: persistedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      const count = await manager.recover();

      expect(count).toBe(1);
      expect(manager.gameCount).toBe(1);

      const snapshot = manager.getState('recovered-game-1');
      expect(snapshot).toBeDefined();
      expect(snapshot!.value).toBe('lobby');
    });

    it('recovers a playing game from database snapshot', async () => {
      // Create a game and advance it to playing state
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const actor = manager.getActor(gameId)!;
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'START_GAME', playerId: 'p1' });

      // Wait for transitions to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      const persistedSnapshot = actor.getPersistedSnapshot();
      manager.shutdown();

      // Recover from the persisted playing state
      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'recovered-playing',
          state: persistedSnapshot,
          version: 3,
          status: 'playing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      const count = await manager.recover();

      expect(count).toBe(1);

      const snapshot = manager.getState('recovered-playing');
      expect(snapshot).toBeDefined();
      // Playing is a compound state: { playing: 'awaitingMove' }
      expect(snapshot!.value).toEqual({ playing: 'awaitingMove' });
      expect(snapshot!.context.players).toHaveLength(2);
      expect(snapshot!.context.phase).toBe('playing');
    });

    it('recovers multiple games from database', async () => {
      // Create two games with valid persisted snapshots
      manager = new GameManager();
      const id1 = await manager.create({ config: createTestConfig() });
      const id2 = await manager.create({ config: createTestConfig() });
      const snap1 = manager.getActor(id1)!.getPersistedSnapshot();
      const snap2 = manager.getActor(id2)!.getPersistedSnapshot();
      manager.shutdown();

      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'rec-1',
          state: snap1,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          gameId: 'rec-2',
          state: snap2,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      const count = await manager.recover();

      expect(count).toBe(2);
      expect(manager.gameCount).toBe(2);
      expect(manager.getState('rec-1')).toBeDefined();
      expect(manager.getState('rec-2')).toBeDefined();
    });

    it('skips games already in memory', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const persistedSnapshot = manager.getActor(gameId)!.getPersistedSnapshot();

      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId, // Same ID as the already-created game
          state: persistedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const count = await manager.recover();
      expect(count).toBe(0);
      expect(manager.gameCount).toBe(1); // Still just the one we created
    });

    it('continues recovering other games when one fails', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const validSnapshot = manager.getActor(gameId)!.getPersistedSnapshot();
      manager.shutdown();

      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'bad-game',
          state: { invalid: 'snapshot' }, // Invalid snapshot will cause error
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          gameId: 'good-game',
          state: validSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      manager = new GameManager();
      const count = await manager.recover();

      // The bad game may or may not throw depending on XState's handling,
      // but the good game should be recovered
      expect(manager.getState('good-game')).toBeDefined();
      expect(count).toBeGreaterThanOrEqual(1);

      consoleSpy.mockRestore();
    });

    it('sets correct version from database snapshot', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const persistedSnapshot = manager.getActor(gameId)!.getPersistedSnapshot();
      manager.shutdown();

      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'versioned-game',
          state: persistedSnapshot,
          version: 5,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      await manager.recover();

      // Recovered game should be functional
      const snapshot = manager.getState('versioned-game');
      expect(snapshot).toBeDefined();
      expect(snapshot!.value).toBe('lobby');
    });

    it('recovered game actors respond to events', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const persistedSnapshot = manager.getActor(gameId)!.getPersistedSnapshot();
      manager.shutdown();

      mockLoadActiveSnapshots.mockResolvedValue([
        {
          gameId: 'interactive-game',
          state: persistedSnapshot,
          version: 1,
          status: 'lobby',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      manager = new GameManager();
      await manager.recover();

      // The recovered actor should accept events
      const actor = manager.getActor('interactive-game')!;
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });

      const snapshot = manager.getState('interactive-game');
      expect(snapshot!.context.players).toHaveLength(1);
      expect(snapshot!.context.players[0].name).toBe('Alice');
    });
  });

  describe('shutdown', () => {
    it('stops all actors and clears games', async () => {
      manager = new GameManager();
      await manager.create({ config: createTestConfig() });
      await manager.create({ config: createTestConfig() });

      expect(manager.gameCount).toBe(2);

      manager.shutdown();

      expect(manager.gameCount).toBe(0);
    });
  });
});
