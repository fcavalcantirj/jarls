import { jest } from '@jest/globals';
import type { QueryResult } from 'pg';

// Mock the db module before importing persistence
const mockQuery = jest.fn<(...args: unknown[]) => Promise<QueryResult>>();

jest.unstable_mockModule('../../db', () => ({
  query: mockQuery,
}));

// Import after mocking
const { saveSnapshot, loadSnapshot, VersionConflictError } = await import('../persistence');

describe('game persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveSnapshot', () => {
    it('inserts a new snapshot when version is 1', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      const state = { id: 'game-1', phase: 'lobby', players: [] };
      await saveSnapshot('game-1', state, 1, 'lobby');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO game_snapshots'),
        ['game-1', JSON.stringify(state), 1, 'lobby']
      );
    });

    it('updates existing snapshot with optimistic locking for version > 1', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      const state = { id: 'game-1', phase: 'playing', players: ['p1', 'p2'] };
      await saveSnapshot('game-1', state, 2, 'playing');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE game_snapshots'), [
        JSON.stringify(state),
        2,
        'playing',
        'game-1',
        1,
      ]);
    });

    it('throws VersionConflictError when update affects no rows', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      await expect(saveSnapshot('game-1', { phase: 'playing' }, 3, 'playing')).rejects.toThrow(
        VersionConflictError
      );
    });

    it('includes game ID and version in VersionConflictError message', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      await expect(saveSnapshot('game-1', { phase: 'playing' }, 3, 'playing')).rejects.toThrow(
        'Version conflict for game game-1: expected version 3'
      );
    });

    it('defaults status to lobby when not provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      await saveSnapshot('game-1', { phase: 'lobby' }, 1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO game_snapshots'),
        ['game-1', JSON.stringify({ phase: 'lobby' }), 1, 'lobby']
      );
    });

    it('serializes complex state as JSON', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      const complexState = {
        id: 'game-1',
        players: [{ id: 'p1', name: 'Alice' }],
        pieces: [{ id: 'piece-1', position: { q: 0, r: 0 } }],
        nested: { deep: { value: 42 } },
      };
      await saveSnapshot('game-1', complexState, 1);

      const callArgs = mockQuery.mock.calls[0] as unknown[];
      expect((callArgs[1] as unknown[])[1]).toBe(JSON.stringify(complexState));
    });
  });

  describe('loadSnapshot', () => {
    it('returns snapshot data when game exists', async () => {
      const now = new Date();
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            game_id: 'game-1',
            state_snapshot: { id: 'game-1', phase: 'playing' },
            version: 3,
            status: 'playing',
            created_at: now,
            updated_at: now,
          },
        ],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      const snapshot = await loadSnapshot('game-1');

      expect(snapshot).toEqual({
        gameId: 'game-1',
        state: { id: 'game-1', phase: 'playing' },
        version: 3,
        status: 'playing',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('returns null when game does not exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      const snapshot = await loadSnapshot('nonexistent-game');

      expect(snapshot).toBeNull();
    });

    it('queries with the correct game ID', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult);

      await loadSnapshot('my-game-id');

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM game_snapshots'), [
        'my-game-id',
      ]);
    });
  });

  describe('VersionConflictError', () => {
    it('has the correct name', () => {
      const error = new VersionConflictError('game-1', 5);
      expect(error.name).toBe('VersionConflictError');
    });

    it('includes game ID and version in message', () => {
      const error = new VersionConflictError('game-42', 10);
      expect(error.message).toBe('Version conflict for game game-42: expected version 10');
    });

    it('is an instance of Error', () => {
      const error = new VersionConflictError('game-1', 1);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
