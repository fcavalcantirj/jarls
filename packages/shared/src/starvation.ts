// @jarls/shared - Starvation mechanics
// Implements the Starvation Rule for stalemate prevention.

import type {
  GameState,
  GameEvent,
  Player,
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
 * Check if a player has any Warriors remaining in the given pieces array.
 */
function playerHasWarriors(pieces: GameState['pieces'], playerId: string): boolean {
  return pieces.some((p) => p.type === 'warrior' && p.playerId === playerId);
}

/**
 * Eliminate Jarls whose grace period has expired (no Warriors for 5+ rounds).
 *
 * During a starvation trigger, any player who has no Warriors and whose
 * roundsSinceLastWarrior >= 5 has their Jarl immediately eliminated.
 *
 * @returns Updated pieces, players, and events from Jarl eliminations
 */
function eliminateStarvedJarls(
  pieces: GameState['pieces'],
  players: Player[]
): { pieces: GameState['pieces']; players: Player[]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const jarlIdsToRemove = new Set<string>();
  const eliminatedPlayerIds = new Set<string>();

  for (const player of players) {
    if (player.isEliminated) continue;
    if (player.roundsSinceLastWarrior == null) continue;

    // Grace period: 5 rounds after losing last warrior
    if (player.roundsSinceLastWarrior >= 5) {
      // Check they still have no warriors
      if (!playerHasWarriors(pieces, player.id)) {
        // Find and eliminate the Jarl
        const jarl = pieces.find((p) => p.type === 'jarl' && p.playerId === player.id);
        if (jarl) {
          jarlIdsToRemove.add(jarl.id);
          eliminatedPlayerIds.add(player.id);
          events.push({
            type: 'JARL_STARVED',
            pieceId: jarl.id,
            playerId: player.id,
            position: jarl.position,
          });
        }
      }
    }
  }

  const newPieces = pieces.filter((p) => !jarlIdsToRemove.has(p.id));
  const newPlayers = players.map((p) =>
    eliminatedPlayerIds.has(p.id) ? { ...p, isEliminated: true } : p
  );

  return { pieces: newPieces, players: newPlayers, events };
}

/**
 * Resolve starvation by removing chosen warriors, eliminating starved Jarls,
 * and checking for game end.
 *
 * Resolution order:
 * 1. Eliminate Jarls whose grace period has expired (no Warriors for 5+ rounds)
 * 2. Remove chosen warriors from players who still have warriors
 * 3. Track grace period for players who just lost their last warrior
 * 4. Reset roundsSinceElimination counter
 * 5. Check for last standing victory
 *
 * @param state - The current game state
 * @param choices - Each player's choice of which warrior to sacrifice
 * @returns StarvationResult with new state, events, and game end info
 */
export function resolveStarvation(state: GameState, choices: StarvationChoice[]): StarvationResult {
  const events: GameEvent[] = [];

  // Step 1: Eliminate Jarls whose grace period has expired
  const jarlResult = eliminateStarvedJarls(state.pieces, state.players);
  let currentPieces = jarlResult.pieces;
  let currentPlayers = jarlResult.players;
  events.push(...jarlResult.events);

  // Step 2: Normal warrior starvation for remaining active players
  // Recalculate candidates with updated pieces (after Jarl eliminations)
  const tempState: GameState = { ...state, pieces: currentPieces, players: currentPlayers };
  const allCandidates = calculateStarvationCandidates(tempState);

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

  // Remove warrior pieces
  currentPieces = currentPieces.filter((p) => !piecesToRemove.has(p.id));

  // Step 3: Update roundsSinceLastWarrior for players who just lost their last warrior
  currentPlayers = currentPlayers.map((player) => {
    if (player.isEliminated) return player;

    // Check warriors before this starvation resolution (using original state pieces)
    const hadWarriorsBefore = playerHasWarriors(state.pieces, player.id);
    const hasWarriorsNow = playerHasWarriors(currentPieces, player.id);

    if (!hasWarriorsNow && hadWarriorsBefore) {
      // Player just lost their last warrior - start grace period
      return { ...player, roundsSinceLastWarrior: 0 };
    }

    if (hasWarriorsNow && player.roundsSinceLastWarrior != null) {
      // Player somehow regained warriors (shouldn't happen, but be safe) - clear tracker
      return { ...player, roundsSinceLastWarrior: null };
    }

    return player;
  });

  // Build new state
  const newState: GameState = {
    ...state,
    pieces: currentPieces,
    players: currentPlayers,
    roundsSinceElimination: 0,
  };

  // Step 4: Check for last standing victory
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

// ============================================================================
// Jarl Grace Period Tracking
// ============================================================================

/**
 * Increment the roundsSinceLastWarrior counter for all players who have no Warriors.
 * This should be called once per round (after all players have moved).
 *
 * Players who still have Warriors are unaffected.
 * Players who already have a counter get it incremented.
 * Players who just lost their last Warrior should have had their counter
 * set to 0 by resolveStarvation; this function increments it each round.
 */
export function incrementJarlGracePeriods(state: GameState): GameState {
  const newPlayers = state.players.map((player) => {
    if (player.isEliminated) return player;

    const hasWarriors = playerHasWarriors(state.pieces, player.id);

    if (hasWarriors) {
      // Player has warriors - no grace period tracking needed
      // Reset if somehow set (e.g., warrior was regained)
      if (player.roundsSinceLastWarrior != null) {
        return { ...player, roundsSinceLastWarrior: null };
      }
      return player;
    }

    // Player has no warriors
    if (player.roundsSinceLastWarrior == null) {
      // First round without warriors (not set by resolveStarvation) - start tracking
      return { ...player, roundsSinceLastWarrior: 1 };
    }

    // Increment existing counter
    return { ...player, roundsSinceLastWarrior: player.roundsSinceLastWarrior + 1 };
  });

  return { ...state, players: newPlayers };
}
