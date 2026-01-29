import { describe, it, expect, afterEach, jest, beforeEach } from '@jest/globals';
import type { GameConfig } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { GameMachineContext } from '../types';

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
 * Helper: create a game, join 2 players, and start it.
 * Returns gameId and player IDs.
 */
async function createStartedGame(manager: InstanceType<typeof GameManager>) {
  const gameId = await manager.create({ config: createTestConfig() });
  const p1 = manager.join(gameId, 'Alice');
  const p2 = manager.join(gameId, 'Bob');
  manager.start(gameId, p1);
  return { gameId, p1, p2 };
}

describe('GameManager - Disconnection', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager?.shutdown();
  });

  describe('onDisconnect', () => {
    it('marks a player as disconnected', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);

      const snapshot = manager.getState(gameId);
      expect(snapshot).toBeDefined();
      const context = snapshot!.context as GameMachineContext;
      expect(context.disconnectedPlayers.has(p1)).toBe(true);
    });

    it('pauses the game when current turn player disconnects', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      // p1 is current player
      const before = manager.getState(gameId);
      expect((before!.context as GameMachineContext).currentPlayerId).toBe(p1);

      manager.onDisconnect(gameId, p1);

      const snapshot = manager.getState(gameId);
      expect(snapshot!.value).toBe('paused');
    });

    it('does not pause the game when non-current player disconnects', async () => {
      manager = new GameManager();
      const { gameId, p1, p2 } = await createStartedGame(manager);

      // p1 is current player, p2 disconnects
      const before = manager.getState(gameId);
      expect((before!.context as GameMachineContext).currentPlayerId).toBe(p1);

      manager.onDisconnect(gameId, p2);

      const snapshot = manager.getState(gameId);
      expect(snapshot!.value).toEqual({ playing: 'awaitingMove' });
      expect((snapshot!.context as GameMachineContext).disconnectedPlayers.has(p2)).toBe(true);
    });

    it('throws when game is not found', async () => {
      manager = new GameManager();

      expect(() => manager.onDisconnect('nonexistent', 'p1')).toThrow('Game not found');
    });

    it('throws when game is in lobby state', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      const p1 = manager.join(gameId, 'Alice');

      expect(() => manager.onDisconnect(gameId, p1)).toThrow('Cannot disconnect in state: lobby');
    });

    it('throws when player is not found in game', async () => {
      manager = new GameManager();
      const { gameId } = await createStartedGame(manager);

      expect(() => manager.onDisconnect(gameId, 'unknown-player')).toThrow(
        'Player not found in game'
      );
    });
  });

  describe('onReconnect', () => {
    it('marks a player as reconnected', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);
      const disconnected = manager.getState(gameId);
      expect((disconnected!.context as GameMachineContext).disconnectedPlayers.has(p1)).toBe(true);

      manager.onReconnect(gameId, p1);

      const snapshot = manager.getState(gameId);
      expect((snapshot!.context as GameMachineContext).disconnectedPlayers.has(p1)).toBe(false);
    });

    it('resumes the game when paused player reconnects', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);
      expect(manager.getState(gameId)!.value).toBe('paused');

      manager.onReconnect(gameId, p1);

      const snapshot = manager.getState(gameId);
      expect(snapshot!.value).toEqual({ playing: 'awaitingMove' });
    });

    it('preserves game state through disconnect and reconnect', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      const before = manager.getState(gameId);
      const beforeCtx = before!.context as GameMachineContext;
      const currentPlayer = beforeCtx.currentPlayerId;
      const turnNumber = beforeCtx.turnNumber;
      const pieceCount = beforeCtx.pieces.length;

      manager.onDisconnect(gameId, p1);
      manager.onReconnect(gameId, p1);

      const after = manager.getState(gameId);
      const afterCtx = after!.context as GameMachineContext;
      expect(afterCtx.currentPlayerId).toBe(currentPlayer);
      expect(afterCtx.turnNumber).toBe(turnNumber);
      expect(afterCtx.pieces.length).toBe(pieceCount);
    });

    it('allows normal gameplay to continue after reconnection', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      manager.onDisconnect(gameId, p1);
      manager.onReconnect(gameId, p1);

      // Find a valid move for p1
      const snapshot = manager.getState(gameId);
      const context = snapshot!.context as GameMachineContext;
      const p1Pieces = context.pieces.filter((p) => p.playerId === p1);
      let moved = false;

      for (const piece of p1Pieces) {
        const moves = getValidMoves(context, piece.id);
        if (moves.length > 0) {
          const result = await manager.makeMove(gameId, p1, {
            pieceId: piece.id,
            destination: moves[0].destination,
          });
          expect(result.success).toBe(true);
          moved = true;
          break;
        }
      }

      expect(moved).toBe(true);
    });

    it('throws when game is not found', async () => {
      manager = new GameManager();

      expect(() => manager.onReconnect('nonexistent', 'p1')).toThrow('Game not found');
    });

    it('throws when game is in lobby state', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });
      manager.join(gameId, 'Alice');

      expect(() => manager.onReconnect(gameId, 'some-player')).toThrow(
        'Cannot reconnect in state: lobby'
      );
    });

    it('throws when player is not disconnected', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      expect(() => manager.onReconnect(gameId, p1)).toThrow('Player is not disconnected');
    });
  });
});
