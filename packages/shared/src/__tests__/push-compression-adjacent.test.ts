/**
 * Test for push compression when defender is directly adjacent to blocker.
 * This tests the edge case where there's no space for compression.
 */

import { describe, it, expect } from '@jest/globals';
import type { GameState, Piece } from '../types.js';
import { applyMove } from '../move.js';

// Helper to create a minimal game state for testing
function createTestState(pieces: Piece[]): GameState {
  return {
    phase: 'playing',
    config: { boardRadius: 3, starvationRounds: 6 },
    pieces,
    players: [
      { id: 'p1', name: 'Player 1', isEliminated: false, color: 'red' },
      { id: 'p2', name: 'Player 2', isEliminated: false, color: 'blue' },
    ],
    currentPlayerId: 'p1',
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
  };
}

// Helper to check for duplicate positions
function hasDuplicatePositions(pieces: Piece[]): boolean {
  const positions = new Set<string>();
  for (const piece of pieces) {
    const key = `${piece.position.q},${piece.position.r}`;
    if (positions.has(key)) {
      return true;
    }
    positions.add(key);
  }
  return false;
}

describe('Push compression when defender is directly adjacent to blocker', () => {
  it('should not create duplicate positions when attacker pushes defender into throne', () => {
    // Setup: Red warrior at (1, -1), Blue warrior at (0, 0) which is the THRONE
    // Wait - warriors can't be on the throne. Let me adjust.

    // Setup: Red warrior at (-1, 0), Blue Jarl at (0, 0) which is the throne
    // Red attacks Blue Jarl on throne - but Jarl can't be pushed OFF throne?
    // Actually, let me think of a different scenario.

    // Better setup:
    // - Shield at position (0, 0) - the throne
    // - Blue warrior at position (1, -1) - adjacent to throne
    // - Red warrior at position (2, -2) - can attack blue
    // When red attacks blue, blue would need to be pushed toward throne,
    // but throne is blocked by shield. Blue can't move, so what happens?

    // Actually shields are only on the throne at game start in some variants.
    // Let me use a simpler scenario with the throne as blocker.

    // Scenario:
    // - Blue JARL at (1, -1) - one hex away from throne in direction 3 (SW)
    // - Red warrior at (2, -2) - can attack blue Jarl toward throne (direction 3)
    // - When pushed, blue Jarl's next position would be (0, 0) - the throne
    // - Jarls CAN be on throne (they win if they move there voluntarily)
    // - But if pushed onto throne, do they stay or is it blocked?

    // Actually according to the code, Warriors compress against throne but Jarls can be pushed onto it.
    // Let me try with a warrior.

    // New scenario with shield:
    // - Shield at (0, 0) - throne (immovable)
    // - Blue warrior at (1, -1) - adjacent to shield, direction 3 leads to throne
    // - Red warrior at (2, -2) - attacks blue toward direction 3
    // Result: Blue can't move (would go onto throne, blocked for warriors)
    //         Red should NOT take blue's position (would create duplicate)

    const shield: Piece = {
      id: 'shield1',
      type: 'shield',
      playerId: null,
      position: { q: 0, r: 0 },
    };

    const blueWarrior: Piece = {
      id: 'blue-w1',
      type: 'warrior',
      playerId: 'p2',
      position: { q: 1, r: -1 }, // Adjacent to throne
    };

    const redWarrior: Piece = {
      id: 'red-w1',
      type: 'warrior',
      playerId: 'p1',
      position: { q: 2, r: -2 }, // Can attack blue toward throne
    };

    // Also need Jarls for valid game state
    const redJarl: Piece = {
      id: 'red-j',
      type: 'jarl',
      playerId: 'p1',
      position: { q: -2, r: 2 },
    };

    const blueJarl: Piece = {
      id: 'blue-j',
      type: 'jarl',
      playerId: 'p2',
      position: { q: 2, r: 0 },
    };

    const state = createTestState([shield, blueWarrior, redWarrior, redJarl, blueJarl]);

    // Red warrior attacks blue warrior toward throne (direction 3 = SW)
    const result = applyMove(state, 'p1', {
      pieceId: 'red-w1',
      destination: { q: 1, r: -1 }, // Blue's position
    });

    console.log('Result:', JSON.stringify(result, null, 2));

    // The move should either:
    // 1. Succeed without creating duplicate positions
    // 2. Or be blocked (return success: false)

    if (result.success) {
      // If move succeeded, verify no duplicate positions
      expect(hasDuplicatePositions(result.newState.pieces)).toBe(false);
    } else {
      // If blocked, that's also acceptable
      expect(result.success).toBe(false);
    }
  });

  it('should not create duplicate positions when pushing chain into shield with no room', () => {
    // Setup: Shield at (0, 0), Blue warrior at (1, -1), Red warrior at (2, -2)
    // Red attacks blue, blue would compress against shield but has no room

    const shield: Piece = {
      id: 'shield1',
      type: 'shield',
      playerId: null,
      position: { q: 0, r: 0 },
    };

    const blueWarrior: Piece = {
      id: 'blue-w1',
      type: 'warrior',
      playerId: 'p2',
      position: { q: 1, r: -1 },
    };

    const redWarrior: Piece = {
      id: 'red-w1',
      type: 'warrior',
      playerId: 'p1',
      position: { q: 2, r: -2 },
    };

    const redJarl: Piece = {
      id: 'red-j',
      type: 'jarl',
      playerId: 'p1',
      position: { q: -2, r: 2 },
    };

    const blueJarl: Piece = {
      id: 'blue-j',
      type: 'jarl',
      playerId: 'p2',
      position: { q: 2, r: 0 },
    };

    const state = createTestState([shield, blueWarrior, redWarrior, redJarl, blueJarl]);

    const result = applyMove(state, 'p1', {
      pieceId: 'red-w1',
      destination: { q: 1, r: -1 },
    });

    // Must not have duplicate positions
    if (result.success) {
      expect(hasDuplicatePositions(result.newState.pieces)).toBe(false);

      // Verify the pieces are at valid, distinct positions
      const redW = result.newState.pieces.find((p) => p.id === 'red-w1');
      const blueW = result.newState.pieces.find((p) => p.id === 'blue-w1');

      expect(redW).toBeDefined();
      expect(blueW).toBeDefined();

      // They should be at different positions
      expect(redW!.position.q !== blueW!.position.q || redW!.position.r !== blueW!.position.r).toBe(
        true
      );
    }
  });
});
