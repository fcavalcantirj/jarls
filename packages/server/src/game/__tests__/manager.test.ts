import { describe, it, expect, afterEach, jest, beforeEach } from '@jest/globals';
import type { GameConfig } from '@jarls/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSaveSnapshotFn = jest
  .fn<(...args: any[]) => Promise<void>>()
  .mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSaveEventFn = jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadSnapshotFn = jest.fn<(...args: any[]) => Promise<null>>().mockResolvedValue(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockLoadEventsFn = jest.fn<(...args: any[]) => Promise<never[]>>().mockResolvedValue([]);

// Mock persistence module before importing GameManager
jest.unstable_mockModule('../persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  VersionConflictError: class VersionConflictError extends Error {},
}));

const { GameManager } = await import('../manager');

const mockSaveSnapshot = mockSaveSnapshotFn;
const mockSaveEvent = mockSaveEventFn;

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

    it('saves the initial snapshot to the database', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(mockSaveSnapshot).toHaveBeenCalledWith(
        gameId,
        expect.objectContaining({ phase: 'lobby', players: [] }),
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
