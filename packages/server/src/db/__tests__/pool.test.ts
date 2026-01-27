import { jest } from '@jest/globals';
import type { QueryResult, PoolClient } from 'pg';

// Mock pg module before importing pool
const mockQuery = jest.fn<(...args: unknown[]) => Promise<QueryResult>>();
const mockConnect = jest.fn<() => Promise<PoolClient>>();
const mockEnd = jest.fn<() => Promise<void>>();
const mockOn = jest.fn();

jest.unstable_mockModule('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
    on: mockOn,
  })),
}));

// Import after mocking
const { query, getClient, closePool } = await import('../pool');

describe('PostgreSQL connection pool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('query()', () => {
    it('executes a query and returns results', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult;
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ id: 1, name: 'test' });
    });

    it('executes a query without params', async () => {
      const mockResult = {
        rows: [{ count: 5 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      } as unknown as QueryResult;
      mockQuery.mockResolvedValueOnce(mockResult);

      const result = await query('SELECT count(*) FROM test');

      expect(mockQuery).toHaveBeenCalledWith('SELECT count(*) FROM test', undefined);
      expect(result.rows[0]).toEqual({ count: 5 });
    });

    it('throws and logs on query error', async () => {
      const dbError = new Error('relation "nonexistent" does not exist');
      mockQuery.mockRejectedValueOnce(dbError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT * FROM nonexistent')).rejects.toThrow(
        'relation "nonexistent" does not exist'
      );

      expect(consoleSpy).toHaveBeenCalledWith('Database query error:', {
        text: 'SELECT * FROM nonexistent',
        message: 'relation "nonexistent" does not exist',
      });

      consoleSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockQuery.mockRejectedValueOnce('string error');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT 1')).rejects.toBe('string error');

      expect(consoleSpy).toHaveBeenCalledWith('Database query error:', {
        text: 'SELECT 1',
        message: 'string error',
      });

      consoleSpy.mockRestore();
    });
  });

  describe('getClient()', () => {
    it('returns a client from the pool', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      } as unknown as PoolClient;
      mockConnect.mockResolvedValueOnce(mockClient);

      const client = await getClient();

      expect(mockConnect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  describe('closePool()', () => {
    it('closes the pool gracefully', async () => {
      mockEnd.mockResolvedValueOnce(undefined);

      await closePool();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});
