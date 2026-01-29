import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

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
