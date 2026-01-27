import crypto from 'node:crypto';
import { redis } from '../redis/client.js';

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const SESSION_PREFIX = 'session:';

export interface SessionData {
  gameId: string;
  playerId: string;
  playerName: string;
}

/**
 * Create a new session stored in Redis with a 24-hour TTL.
 * Returns a 64-character hex token.
 */
export async function createSession(
  gameId: string,
  playerId: string,
  playerName: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const data: SessionData = { gameId, playerId, playerName };

  await redis.set(`${SESSION_PREFIX}${token}`, JSON.stringify(data), 'EX', SESSION_TTL_SECONDS);

  return token;
}

/**
 * Validate a session token. Returns session data if valid, null otherwise.
 */
export async function validateSession(token: string): Promise<SessionData | null> {
  const raw = await redis.get(`${SESSION_PREFIX}${token}`);
  if (!raw) return null;

  return JSON.parse(raw) as SessionData;
}
