import { query } from '../db';

/**
 * Row shape returned from game_events table.
 */
interface GameEventRow {
  event_id: number;
  game_id: string;
  event_type: string;
  event_data: unknown;
  created_at: Date;
}

/**
 * Event data returned by loadEvents.
 */
export interface GameEventRecord {
  eventId: number;
  gameId: string;
  eventType: string;
  eventData: unknown;
  createdAt: Date;
}

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

/**
 * Save a game event to the database.
 *
 * @param gameId - The game this event belongs to
 * @param eventType - The event type string (e.g. 'MOVE', 'PUSH', 'ELIMINATED')
 * @param eventData - The event payload (serialized as JSONB)
 */
export async function saveEvent(
  gameId: string,
  eventType: string,
  eventData: unknown = {}
): Promise<void> {
  await query(
    `INSERT INTO game_events (game_id, event_type, event_data)
     VALUES ($1, $2, $3)`,
    [gameId, eventType, JSON.stringify(eventData)]
  );
}

/**
 * Load all active (non-ended) game snapshots from the database.
 * Used during server recovery to restore in-progress games.
 *
 * @returns Array of snapshot records for games that are not in 'ended' status
 */
export async function loadActiveSnapshots(): Promise<GameSnapshot[]> {
  const result = await query<GameSnapshotRow>(
    `SELECT game_id, state_snapshot, version, status, created_at, updated_at
     FROM game_snapshots
     WHERE status != $1
     ORDER BY created_at ASC`,
    ['ended']
  );

  return result.rows.map((row) => ({
    gameId: row.game_id,
    state: row.state_snapshot,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Load all events for a game, ordered by creation time (ascending).
 *
 * @param gameId - The unique game identifier
 * @returns Array of event records, ordered by created_at ASC
 */
export async function loadEvents(gameId: string): Promise<GameEventRecord[]> {
  const result = await query<GameEventRow>(
    `SELECT event_id, game_id, event_type, event_data, created_at
     FROM game_events
     WHERE game_id = $1
     ORDER BY created_at ASC, event_id ASC`,
    [gameId]
  );

  return result.rows.map((row) => ({
    eventId: row.event_id,
    gameId: row.game_id,
    eventType: row.event_type,
    eventData: row.event_data,
    createdAt: row.created_at,
  }));
}
