// @jarls/shared - Starvation mechanics
// Implements the Starvation Rule for stalemate prevention.

import type { GameState } from './types.js';

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
