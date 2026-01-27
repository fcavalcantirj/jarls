import { describe, it, expect, afterEach, jest, beforeEach } from '@jest/globals';
import type { GameConfig, MoveCommand } from '@jarls/shared';
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

/**
 * Helper: find a valid move for the current player.
 */
function findValidMove(
  manager: InstanceType<typeof GameManager>,
  gameId: string
): { pieceId: string; command: MoveCommand } | null {
  const snapshot = manager.getState(gameId)!;
  const context = snapshot.context as GameMachineContext;
  const currentPlayerId = context.currentPlayerId!;

  // Find a piece belonging to the current player
  const playerPieces = context.pieces.filter((p) => p.playerId === currentPlayerId);

  for (const piece of playerPieces) {
    const validMoves = getValidMoves(context, piece.id);
    if (validMoves.length > 0) {
      // Pick a simple move (non-attack) if available, otherwise any
      const simpleMove = validMoves.find((m) => m.moveType === 'move');
      const move = simpleMove ?? validMoves[0];
      return {
        pieceId: piece.id,
        command: { pieceId: piece.id, destination: move.destination },
      };
    }
  }

  return null;
}

describe('GameManager - move execution', () => {
  let manager: InstanceType<typeof GameManager>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager?.shutdown();
  });

  describe('makeMove', () => {
    it('executes a valid move and returns success', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      const moveInfo = findValidMove(manager, gameId);
      expect(moveInfo).not.toBeNull();

      const result = manager.makeMove(gameId, p1, moveInfo!.command);

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('updates the game state after a valid move', async () => {
      manager = new GameManager();
      const { gameId, p1, p2 } = await createStartedGame(manager);

      const moveInfo = findValidMove(manager, gameId);
      expect(moveInfo).not.toBeNull();

      manager.makeMove(gameId, p1, moveInfo!.command);

      const snapshot = manager.getState(gameId)!;
      const context = snapshot.context as GameMachineContext;
      // After p1 moves, it should be p2's turn
      expect(context.currentPlayerId).toBe(p2);
      expect(context.turnNumber).toBe(1);
    });

    it('returns failure when it is not the player turn', async () => {
      manager = new GameManager();
      const { gameId, p2 } = await createStartedGame(manager);

      // p1 goes first, so p2 cannot move yet
      const snapshot = manager.getState(gameId)!;
      const context = snapshot.context as GameMachineContext;
      const p2Pieces = context.pieces.filter((p) => p.playerId === p2);
      const p2Piece = p2Pieces[0];

      const result = manager.makeMove(gameId, p2, {
        pieceId: p2Piece.id,
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not your turn');
    });

    it('returns failure for an invalid move command', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      // Try to move to an invalid destination (the piece's own position)
      const snapshot = manager.getState(gameId)!;
      const context = snapshot.context as GameMachineContext;
      const p1Pieces = context.pieces.filter((p) => p.playerId === p1);
      const piece = p1Pieces[0];

      const result = manager.makeMove(gameId, p1, {
        pieceId: piece.id,
        destination: piece.position,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('does not update state machine on invalid move', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      const snapshotBefore = manager.getState(gameId)!;
      const contextBefore = snapshotBefore.context as GameMachineContext;

      // Invalid move - move to own position
      const p1Pieces = contextBefore.pieces.filter((p) => p.playerId === p1);
      const piece = p1Pieces[0];

      manager.makeMove(gameId, p1, {
        pieceId: piece.id,
        destination: piece.position,
      });

      const snapshotAfter = manager.getState(gameId)!;
      const contextAfter = snapshotAfter.context as GameMachineContext;
      // Turn should not have advanced
      expect(contextAfter.currentPlayerId).toBe(p1);
      expect(contextAfter.turnNumber).toBe(contextBefore.turnNumber);
    });

    it('throws when game does not exist', () => {
      manager = new GameManager();

      expect(() =>
        manager.makeMove('non-existent', 'p1', { pieceId: 'x', destination: { q: 0, r: 0 } })
      ).toThrow('Game not found');
    });

    it('throws when game is not in playing state', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(() =>
        manager.makeMove(gameId, 'p1', { pieceId: 'x', destination: { q: 0, r: 0 } })
      ).toThrow('Cannot make move in state: lobby');
    });

    it('returns failure for a non-existent piece', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      const result = manager.makeMove(gameId, p1, {
        pieceId: 'non-existent-piece',
        destination: { q: 0, r: 0 },
      });

      expect(result.success).toBe(false);
    });

    it('allows consecutive moves from different players', async () => {
      manager = new GameManager();
      const { gameId, p1, p2 } = await createStartedGame(manager);

      // Player 1 moves
      const move1 = findValidMove(manager, gameId);
      expect(move1).not.toBeNull();
      const result1 = manager.makeMove(gameId, p1, move1!.command);
      expect(result1.success).toBe(true);

      // Player 2 moves
      const move2 = findValidMove(manager, gameId);
      expect(move2).not.toBeNull();
      const result2 = manager.makeMove(gameId, p2, move2!.command);
      expect(result2.success).toBe(true);

      const snapshot = manager.getState(gameId)!;
      const context = snapshot.context as GameMachineContext;
      expect(context.turnNumber).toBe(2);
    });

    it('advances state machine to checkingGameEnd and back to awaitingMove', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      const moveInfo = findValidMove(manager, gameId);
      expect(moveInfo).not.toBeNull();

      manager.makeMove(gameId, p1, moveInfo!.command);

      // After a normal move, the machine should be back in awaitingMove
      const snapshot = manager.getState(gameId)!;
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });
    });
  });

  describe('submitStarvationChoice', () => {
    it('throws when game does not exist', () => {
      manager = new GameManager();

      expect(() => manager.submitStarvationChoice('non-existent', 'p1', 'piece1')).toThrow(
        'Game not found'
      );
    });

    it('throws when game is not in starvation state', async () => {
      manager = new GameManager();
      const { gameId, p1 } = await createStartedGame(manager);

      expect(() => manager.submitStarvationChoice(gameId, p1, 'piece1')).toThrow(
        'Cannot submit starvation choice in state: playing'
      );
    });

    it('throws when game is in lobby state', async () => {
      manager = new GameManager();
      const gameId = await manager.create({ config: createTestConfig() });

      expect(() => manager.submitStarvationChoice(gameId, 'p1', 'piece1')).toThrow(
        'Cannot submit starvation choice in state: lobby'
      );
    });
  });
});
