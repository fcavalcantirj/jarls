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
const { DatabaseUnavailableError } = await import('../../errors/index');

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

      // Verify error was logged (new format uses JSON.stringify)
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toBe('Database query error:');
      const loggedInfo = JSON.parse(logCall[1] as string);
      expect(loggedInfo.text).toBe('SELECT * FROM nonexistent');
      expect(loggedInfo.message).toBe('relation "nonexistent" does not exist');

      consoleSpy.mockRestore();
    });

    it('handles non-Error thrown values', async () => {
      mockQuery.mockRejectedValueOnce('string error');

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT 1')).rejects.toBe('string error');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0];
      const loggedInfo = JSON.parse(logCall[1] as string);
      expect(loggedInfo.text).toBe('SELECT 1');
      expect(loggedInfo.rawError).toBe('string error');

      consoleSpy.mockRestore();
    });

    it('throws DatabaseUnavailableError on ETIMEDOUT', async () => {
      const timeoutError = new Error('connect ETIMEDOUT') as Error & { code: string };
      timeoutError.code = 'ETIMEDOUT';
      mockQuery.mockRejectedValueOnce(timeoutError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const error = await query('SELECT 1').catch((e) => e);
      expect(error).toBeInstanceOf(DatabaseUnavailableError);
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('DATABASE_UNAVAILABLE');

      consoleSpy.mockRestore();
    });

    it('throws DatabaseUnavailableError on ECONNREFUSED', async () => {
      const refusedError = new Error('connect ECONNREFUSED') as Error & { code: string };
      refusedError.code = 'ECONNREFUSED';
      mockQuery.mockRejectedValueOnce(refusedError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT 1')).rejects.toThrow(DatabaseUnavailableError);

      consoleSpy.mockRestore();
    });

    it('throws DatabaseUnavailableError on AggregateError with ETIMEDOUT', async () => {
      const subError = new Error('connect ETIMEDOUT') as Error & { code: string };
      subError.code = 'ETIMEDOUT';
      const aggError = new AggregateError([subError], 'All connection attempts failed');
      mockQuery.mockRejectedValueOnce(aggError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT 1')).rejects.toThrow(DatabaseUnavailableError);

      consoleSpy.mockRestore();
    });

    it('throws DatabaseUnavailableError on timeout message', async () => {
      const timeoutError = new Error('Connection timed out after 30000ms');
      mockQuery.mockRejectedValueOnce(timeoutError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('SELECT 1')).rejects.toThrow(DatabaseUnavailableError);

      consoleSpy.mockRestore();
    });

    it('logs PostgreSQL-specific error fields', async () => {
      const pgError = new Error('duplicate key value violates unique constraint') as Error & {
        code: string;
        detail: string;
        constraint: string;
        table: string;
      };
      pgError.code = '23505';
      pgError.detail = 'Key (id)=(1) already exists.';
      pgError.constraint = 'games_pkey';
      pgError.table = 'games';
      mockQuery.mockRejectedValueOnce(pgError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(query('INSERT INTO games')).rejects.toThrow('duplicate key');

      const logCall = consoleSpy.mock.calls[0];
      const loggedInfo = JSON.parse(logCall[1] as string);
      expect(loggedInfo.code).toBe('23505');
      expect(loggedInfo.detail).toBe('Key (id)=(1) already exists.');
      expect(loggedInfo.constraint).toBe('games_pkey');
      expect(loggedInfo.table).toBe('games');

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
