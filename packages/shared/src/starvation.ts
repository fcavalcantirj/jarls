// @jarls/shared - Starvation mechanics
// Implements the Starvation Rule for stalemate prevention.

import type {
  GameState,
  GameEvent,
  StarvationCandidates,
  StarvationChoice,
  StarvationResult,
} from './types.js';
import { hexDistanceAxial } from './hex.js';
import { checkLastStanding } from './move.js';

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

// ============================================================================
// Starvation Resolution
// ============================================================================

/**
 * Resolve starvation by removing chosen warriors and checking for game end.
 *
 * Each player with warriors must choose one warrior to sacrifice. The chosen
 * warrior must be a valid candidate (at max distance from Throne).
 *
 * After removing warriors:
 * - roundsSinceElimination resets to 0
 * - Check for last standing victory (if a Jarl's last warrior was removed,
 *   the Jarl stays but could be eliminated later via Jarl starvation)
 *
 * @param state - The current game state
 * @param choices - Each player's choice of which warrior to sacrifice
 * @returns StarvationResult with new state, events, and game end info
 */
export function resolveStarvation(state: GameState, choices: StarvationChoice[]): StarvationResult {
  // Calculate current candidates for validation
  const allCandidates = calculateStarvationCandidates(state);

  const events: GameEvent[] = [];
  const piecesToRemove: Set<string> = new Set();

  // Validate and collect each choice
  for (const choice of choices) {
    const playerCandidates = allCandidates.find((c) => c.playerId === choice.playerId);

    if (!playerCandidates) {
      continue; // Player not found or eliminated - skip
    }

    if (playerCandidates.candidates.length === 0) {
      continue; // Player has no warriors - skip
    }

    const isValidCandidate = playerCandidates.candidates.some((c) => c.id === choice.pieceId);
    if (!isValidCandidate) {
      // Invalid choice - pick the first candidate as fallback
      const fallback = playerCandidates.candidates[0];
      piecesToRemove.add(fallback.id);
      events.push({
        type: 'ELIMINATED',
        pieceId: fallback.id,
        playerId: fallback.playerId,
        position: fallback.position,
        cause: 'starvation',
      });
      continue;
    }

    // Valid choice - find the piece to get its position
    const piece = playerCandidates.candidates.find((c) => c.id === choice.pieceId)!;
    piecesToRemove.add(piece.id);
    events.push({
      type: 'ELIMINATED',
      pieceId: piece.id,
      playerId: piece.playerId,
      position: piece.position,
      cause: 'starvation',
    });
  }

  // Also handle players who have candidates but didn't submit a choice
  for (const playerCandidates of allCandidates) {
    if (playerCandidates.candidates.length === 0) continue;

    const hasChoice = choices.some((c) => c.playerId === playerCandidates.playerId);
    if (!hasChoice) {
      // No choice submitted - auto-select first candidate
      const fallback = playerCandidates.candidates[0];
      // Avoid double-removing if somehow already added
      if (!piecesToRemove.has(fallback.id)) {
        piecesToRemove.add(fallback.id);
        events.push({
          type: 'ELIMINATED',
          pieceId: fallback.id,
          playerId: fallback.playerId,
          position: fallback.position,
          cause: 'starvation',
        });
      }
    }
  }

  // Remove pieces and reset counter
  const newPieces = state.pieces.filter((p) => !piecesToRemove.has(p.id));
  const newState: GameState = {
    ...state,
    pieces: newPieces,
    roundsSinceElimination: 0,
  };

  // Check for last standing victory
  const lastStanding = checkLastStanding(newState);
  if (lastStanding.isVictory && lastStanding.winnerId) {
    const endedState: GameState = {
      ...newState,
      phase: 'ended',
      winnerId: lastStanding.winnerId,
      winCondition: 'lastStanding',
    };

    events.push({
      type: 'GAME_ENDED',
      winnerId: lastStanding.winnerId,
      winCondition: 'lastStanding',
    });

    return {
      newState: endedState,
      events,
      gameEnded: true,
      winnerId: lastStanding.winnerId,
    };
  }

  return {
    newState,
    events,
    gameEnded: false,
    winnerId: null,
  };
}
