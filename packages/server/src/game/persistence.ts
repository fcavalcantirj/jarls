import { query } from '../db';

/**
 * Row shape returned from game_snapshots table.
 */
interface GameSnapshotRow {
  game_id: string;
  state_snapshot: unknown;
  version: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Snapshot data returned by loadSnapshot.
 */
export interface GameSnapshot {
  gameId: string;
  state: unknown;
  version: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error thrown when optimistic locking detects a version conflict.
 */
export class VersionConflictError extends Error {
  constructor(gameId: string, expectedVersion: number) {
    super(`Version conflict for game ${gameId}: expected version ${expectedVersion}`);
    this.name = 'VersionConflictError';
  }
}

/**
 * Save a game state snapshot to the database.
 * Uses INSERT on first save (version 1) and UPDATE with optimistic locking
 * for subsequent saves.
 *
 * @param gameId - The unique game identifier
 * @param state - The game state to persist (serialized as JSONB)
 * @param version - The expected version number (for optimistic locking)
 * @param status - The game status string (e.g. 'lobby', 'playing', 'ended')
 * @throws VersionConflictError if the version in the DB doesn't match expectedVersion - 1
 */
export async function saveSnapshot(
  gameId: string,
  state: unknown,
  version: number,
  status: string = 'lobby'
): Promise<void> {
  if (version === 1) {
    await query(
      `INSERT INTO game_snapshots (game_id, state_snapshot, version, status)
       VALUES ($1, $2, $3, $4)`,
      [gameId, JSON.stringify(state), version, status]
    );
    return;
  }

  const result = await query(
    `UPDATE game_snapshots
     SET state_snapshot = $1, version = $2, status = $3, updated_at = now()
     WHERE game_id = $4 AND version = $5`,
    [JSON.stringify(state), version, status, gameId, version - 1]
  );

  if (result.rowCount === 0) {
    throw new VersionConflictError(gameId, version);
  }
}

/**
 * Load a game state snapshot from the database.
 *
 * @param gameId - The unique game identifier
 * @returns The snapshot data, or null if no game found
 */
export async function loadSnapshot(gameId: string): Promise<GameSnapshot | null> {
  const result = await query<GameSnapshotRow>(
    `SELECT game_id, state_snapshot, version, status, created_at, updated_at
     FROM game_snapshots
     WHERE game_id = $1`,
    [gameId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    gameId: row.game_id,
    state: row.state_snapshot,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
