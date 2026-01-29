import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseUnavailableError } from '../errors/index.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://jarls:jarls@localhost:5432/jarls';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle database client', err);
});

/**
 * Check if an error is a database connection/timeout error that should return 503.
 * Handles ETIMEDOUT, ECONNREFUSED, AggregateError (from Node.js connection attempts), etc.
 */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  // Check for direct error codes
  const errWithCode = err as Error & { code?: string };
  if (errWithCode.code === 'ETIMEDOUT' || errWithCode.code === 'ECONNREFUSED') {
    return true;
  }

  // Check for AggregateError (Node.js wraps multiple connection failures)
  if (err.name === 'AggregateError' && 'errors' in err) {
    const aggErr = err as AggregateError;
    return aggErr.errors.some((e) => {
      const subErr = e as Error & { code?: string };
      return subErr.code === 'ETIMEDOUT' || subErr.code === 'ECONNREFUSED';
    });
  }

  // Check message for timeout-related text
  const msg = err.message.toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('connection refused')) {
    return true;
  }

  return false;
}

/**
 * Execute a parameterized query against the pool.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    // Log detailed error info for debugging
    const errorInfo: Record<string, unknown> = { text };
    if (err instanceof Error) {
      errorInfo.message = err.message;
      errorInfo.name = err.name;
      errorInfo.stack = err.stack;
      // PostgreSQL errors have additional fields
      const pgErr = err as unknown as Record<string, unknown>;
      if (pgErr.code) errorInfo.code = pgErr.code;
      if (pgErr.detail) errorInfo.detail = pgErr.detail;
      if (pgErr.constraint) errorInfo.constraint = pgErr.constraint;
      if (pgErr.column) errorInfo.column = pgErr.column;
      if (pgErr.table) errorInfo.table = pgErr.table;
    } else {
      errorInfo.rawError = String(err);
    }
    console.error('Database query error:', JSON.stringify(errorInfo, null, 2));

    // Convert connection/timeout errors to DatabaseUnavailableError (503)
    if (isConnectionError(err)) {
      throw new DatabaseUnavailableError('Database connection failed. Please try again later.');
    }
    throw err;
  }
}

/**
 * Get a dedicated client from the pool for use in transactions.
 * Caller is responsible for calling client.release() when done.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Gracefully shut down the pool, closing all connections.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export { pool };
