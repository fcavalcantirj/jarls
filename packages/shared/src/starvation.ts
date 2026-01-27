// @jarls/shared - Starvation mechanics
// Implements the Starvation Rule for stalemate prevention.

import type { GameState, StarvationCandidates } from './types.js';
import { hexDistanceAxial } from './hex.js';

// ============================================================================
// Starvation Trigger
// ============================================================================

/** Result of checking whether starvation should trigger */
export interface StarvationTriggerResult {
  /** Whether starvation is triggered this round */
  triggered: boolean;
  /** Whether this is the initial trigger (at 10 rounds) vs recurring (15, 20, 25...) */
  isInitial: boolean;
}

/**
 * Check if starvation should trigger based on rounds since last elimination.
 *
 * Rules:
 * - First trigger at exactly 10 rounds with no elimination
 * - Subsequent triggers every 5 rounds (15, 20, 25, ...)
 * - No trigger at any other round count
 */
export function checkStarvationTrigger(state: GameState): StarvationTriggerResult {
  const rounds = state.roundsSinceElimination;

  if (rounds < 10) {
    return { triggered: false, isInitial: false };
  }

  if (rounds === 10) {
    return { triggered: true, isInitial: true };
  }

  // After 10, trigger every 5 rounds (15, 20, 25, ...)
  if ((rounds - 10) % 5 === 0) {
    return { triggered: true, isInitial: false };
  }

  return { triggered: false, isInitial: false };
}

// ============================================================================
// Starvation Candidates
// ============================================================================

/** The Throne position (center of the board) */
const THRONE: { q: number; r: number } = { q: 0, r: 0 };

/**
 * Calculate starvation candidates for all active players.
 *
 * For each player, find the Warriors that are furthest from the Throne.
 * These are the candidates that can be sacrificed during starvation.
 * If multiple Warriors are equidistant (tied for furthest), all are candidates.
 *
 * Players with no Warriors return an empty candidates array.
 */
export function calculateStarvationCandidates(state: GameState): StarvationCandidates {
  const result: StarvationCandidates = [];

  for (const player of state.players) {
    if (player.isEliminated) continue;

    const warriors = state.pieces.filter((p) => p.type === 'warrior' && p.playerId === player.id);

    if (warriors.length === 0) {
      result.push({
        playerId: player.id,
        candidates: [],
        maxDistance: 0,
      });
      continue;
    }

    // Find max distance from Throne
    let maxDistance = 0;
    for (const w of warriors) {
      const dist = hexDistanceAxial(w.position, THRONE);
      if (dist > maxDistance) {
        maxDistance = dist;
      }
    }

    // Collect all warriors at max distance
    const candidates = warriors.filter((w) => hexDistanceAxial(w.position, THRONE) === maxDistance);

    result.push({
      playerId: player.id,
      candidates,
      maxDistance,
    });
  }

  return result;
}
