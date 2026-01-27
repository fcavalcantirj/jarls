import { describe, it, expect, afterEach, jest, beforeEach } from '@jest/globals';
import type { GameConfig } from '@jarls/shared';
import type { GameMachineContext } from '../../game/types';

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
jest.unstable_mockModule('../../game/persistence', () => ({
  saveSnapshot: mockSaveSnapshotFn,
  saveEvent: mockSaveEventFn,
  loadSnapshot: mockLoadSnapshotFn,
  loadEvents: mockLoadEventsFn,
  loadActiveSnapshots: mockLoadActiveSnapshotsFn,
  VersionConflictError: class VersionConflictError extends Error {},
}));

const { GameManager } = await import('../../game/manager');

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
 * Poll until a condition is met, or timeout.
 */
async function waitUntil(
  conditionFn: () => boolean,
  timeoutMs = 3000,
  intervalMs = 50
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (conditionFn()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}

describe('AI Integration - AI makes moves on its turn', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Give pending AI operations a moment to settle before shutting down
    await new Promise((resolve) => setTimeout(resolve, 100));
    manager?.shutdown();
  });

  it('AI player joins game and is tracked', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    const humanId = manager.join(gameId, 'Human');
    const aiId = manager.addAIPlayer(gameId, 'random');

    expect(typeof aiId).toBe('string');
    expect(aiId).not.toBe(humanId);
    expect(manager.isAIPlayer(gameId, aiId)).toBe(true);
    expect(manager.isAIPlayer(gameId, humanId)).toBe(false);

    const snapshot = manager.getState(gameId)!;
    const context = snapshot.context as GameMachineContext;
    expect(context.players).toHaveLength(2);
  });

  it('AI makes a move automatically when it is its turn', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    const humanId = manager.join(gameId, 'Human');
    const aiId = manager.addAIPlayer(gameId, 'random');

    manager.start(gameId, humanId);

    const snapshot = manager.getState(gameId)!;
    const context = snapshot.context as GameMachineContext;
    const initialTurnNumber = context.turnNumber;
    const isAIFirst = context.currentPlayerId === aiId;

    if (!isAIFirst) {
      // Human goes first; make a human move so AI gets its turn
      const { getValidMoves } = await import('@jarls/shared');
      const playerPieces = context.pieces.filter((p) => p.playerId === humanId);

      let moved = false;
      for (const piece of playerPieces) {
        const validMoves = getValidMoves(context, piece.id);
        if (validMoves.length > 0) {
          const move = validMoves.find((m) => m.moveType === 'move') ?? validMoves[0];
          manager.makeMove(gameId, humanId, {
            pieceId: piece.id,
            destination: move.destination,
          });
          moved = true;
          break;
        }
      }
      expect(moved).toBe(true);
    }

    // The AI should now have a turn. Wait for it to advance the turn.
    const turnBeforeAI = isAIFirst ? initialTurnNumber : initialTurnNumber + 1;
    await waitUntil(() => {
      const s = manager.getState(gameId)!;
      const c = s.context as GameMachineContext;
      return c.turnNumber > turnBeforeAI;
    });

    const afterContext = manager.getState(gameId)!.context as GameMachineContext;
    // The AI successfully made a move, advancing the turn number
    expect(afterContext.turnNumber).toBeGreaterThan(turnBeforeAI);
  }, 10000);

  it('heuristic AI makes a move automatically', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    const humanId = manager.join(gameId, 'Human');
    const aiId = manager.addAIPlayer(gameId, 'heuristic');

    expect(manager.isAIPlayer(gameId, aiId)).toBe(true);

    manager.start(gameId, humanId);

    const snapshot = manager.getState(gameId)!;
    const context = snapshot.context as GameMachineContext;
    const initialTurnNumber = context.turnNumber;
    const isAIFirst = context.currentPlayerId === aiId;

    if (!isAIFirst) {
      // Human moves first
      const { getValidMoves } = await import('@jarls/shared');
      const playerPieces = context.pieces.filter((p) => p.playerId === humanId);
      for (const piece of playerPieces) {
        const validMoves = getValidMoves(context, piece.id);
        if (validMoves.length > 0) {
          const move = validMoves.find((m) => m.moveType === 'move') ?? validMoves[0];
          manager.makeMove(gameId, humanId, {
            pieceId: piece.id,
            destination: move.destination,
          });
          break;
        }
      }
    }

    // Wait for AI to make its move (turn advances)
    const turnBeforeAI = isAIFirst ? initialTurnNumber : initialTurnNumber + 1;
    await waitUntil(() => {
      const s = manager.getState(gameId)!;
      const c = s.context as GameMachineContext;
      return c.turnNumber > turnBeforeAI;
    });

    const afterContext = manager.getState(gameId)!.context as GameMachineContext;
    // AI has completed at least one move
    expect(afterContext.turnNumber).toBeGreaterThan(turnBeforeAI);
  }, 10000);

  it('AI gets a Norse name when added', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    manager.join(gameId, 'Human');
    manager.addAIPlayer(gameId, 'random');

    const snapshot = manager.getState(gameId)!;
    const context = snapshot.context as GameMachineContext;

    const aiPlayerInfo = context.players[1];
    expect(aiPlayerInfo.name).toBeTruthy();
    expect(aiPlayerInfo.name.length).toBeGreaterThan(0);
  });

  it('cannot add AI player to a full game', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    manager.join(gameId, 'Player1');
    manager.join(gameId, 'Player2');

    expect(() => manager.addAIPlayer(gameId, 'random')).toThrow('Game is full');
  });

  it('cannot add AI player to a non-lobby game', async () => {
    manager = new GameManager();
    const gameId = await manager.create({ config: createTestConfig() });

    const p1 = manager.join(gameId, 'Human');
    manager.addAIPlayer(gameId, 'random');
    manager.start(gameId, p1);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(() => manager.addAIPlayer(gameId, 'random')).toThrow(
      'Cannot add AI player in state: playing'
    );
  });

  it('isAIPlayer returns false for non-existent game', () => {
    manager = new GameManager();
    expect(manager.isAIPlayer('nonexistent', 'player1')).toBe(false);
  });
});
