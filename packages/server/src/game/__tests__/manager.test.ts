import { describe, it, expect, afterEach } from '@jest/globals';
import { GameManager } from '../manager';
import type { GameConfig } from '@jarls/shared';

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
  let manager: GameManager;

  afterEach(() => {
    manager?.shutdown();
  });

  describe('create', () => {
    it('creates a game and returns a game ID', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });

      expect(typeof gameId).toBe('string');
      expect(gameId.length).toBeGreaterThan(0);
    });

    it('creates games with unique IDs', () => {
      manager = new GameManager();
      const id1 = manager.create({ config: createTestConfig() });
      const id2 = manager.create({ config: createTestConfig() });

      expect(id1).not.toBe(id2);
    });

    it('increments game count when creating games', () => {
      manager = new GameManager();
      expect(manager.gameCount).toBe(0);

      manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(1);

      manager.create({ config: createTestConfig() });
      expect(manager.gameCount).toBe(2);
    });

    it('starts the game in lobby state', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });
      const snapshot = manager.getState(gameId);

      expect(snapshot).toBeDefined();
      expect(snapshot!.value).toBe('lobby');
      expect(snapshot!.context.players).toEqual([]);
      expect(snapshot!.context.phase).toBe('lobby');
    });

    it('initializes game with the provided config', () => {
      manager = new GameManager();
      const config = createTestConfig({ turnTimerMs: 30000 });
      const gameId = manager.create({ config });
      const snapshot = manager.getState(gameId);

      expect(snapshot!.context.config.playerCount).toBe(2);
      expect(snapshot!.context.config.boardRadius).toBe(3);
      expect(snapshot!.context.turnTimerMs).toBe(30000);
    });
  });

  describe('getState', () => {
    it('returns the snapshot for an existing game', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });
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

    it('returns all games', () => {
      manager = new GameManager();
      const id1 = manager.create({ config: createTestConfig() });
      const id2 = manager.create({ config: createTestConfig() });
      const games = manager.listGames();

      expect(games).toHaveLength(2);
      const gameIds = games.map((g) => g.gameId);
      expect(gameIds).toContain(id1);
      expect(gameIds).toContain(id2);
    });

    it('returns correct game summaries', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });
      const games = manager.listGames();

      expect(games[0]).toEqual({
        gameId,
        status: 'lobby',
        playerCount: 0,
        maxPlayers: 2,
        players: [],
      });
    });

    it('filters games by status', () => {
      manager = new GameManager();
      manager.create({ config: createTestConfig() });
      manager.create({ config: createTestConfig() });

      const lobbyGames = manager.listGames({ status: 'lobby' });
      expect(lobbyGames).toHaveLength(2);

      const playingGames = manager.listGames({ status: 'playing' });
      expect(playingGames).toHaveLength(0);
    });

    it('updates player info after players join', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });
      const actor = manager.getActor(gameId);

      actor!.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });

      const games = manager.listGames();
      expect(games[0].playerCount).toBe(1);
      expect(games[0].players).toEqual([{ id: 'p1', name: 'Alice' }]);
    });
  });

  describe('getActor', () => {
    it('returns the actor for an existing game', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });
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
    it('removes an existing game and returns true', () => {
      manager = new GameManager();
      const gameId = manager.create({ config: createTestConfig() });

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
    it('stops all actors and clears games', () => {
      manager = new GameManager();
      manager.create({ config: createTestConfig() });
      manager.create({ config: createTestConfig() });

      expect(manager.gameCount).toBe(2);

      manager.shutdown();

      expect(manager.gameCount).toBe(0);
    });
  });
});
