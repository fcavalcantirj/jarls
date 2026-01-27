import { resolveStarvation, createInitialState } from '../index';
import type { GameState, StarvationChoice } from '../types';

/**
 * Helper to create a playing game state with specific pieces for starvation testing.
 */
function createStarvationTestState(): GameState {
  const state = createInitialState(['Alice', 'Bob']);
  state.phase = 'playing';
  state.roundsSinceElimination = 10; // At starvation trigger point

  const p1 = state.players[0];
  const p2 = state.players[1];

  // Replace pieces with known positions for predictable testing
  const shields = state.pieces.filter((p) => p.type === 'shield');
  state.pieces = [
    // Jarls
    { id: 'jarl-1', type: 'jarl', playerId: p1.id, position: { q: 3, r: 0 } },
    { id: 'jarl-2', type: 'jarl', playerId: p2.id, position: { q: -3, r: 0 } },
    // P1 warriors: w1 at distance 2, w2 at distance 3 (furthest)
    { id: 'w1-a', type: 'warrior', playerId: p1.id, position: { q: 1, r: -1 } },
    { id: 'w1-b', type: 'warrior', playerId: p1.id, position: { q: 3, r: -1 } },
    // P2 warriors: w2-a at distance 2, w2-b at distance 3 (furthest)
    { id: 'w2-a', type: 'warrior', playerId: p2.id, position: { q: -1, r: 1 } },
    { id: 'w2-b', type: 'warrior', playerId: p2.id, position: { q: -3, r: 1 } },
    ...shields,
  ];

  return state;
}

describe('resolveStarvation', () => {
  describe('normal starvation removes warriors', () => {
    it('should remove the chosen warriors from the game', () => {
      const state = createStarvationTestState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-b' }, // P1 chooses furthest warrior
        { playerId: p2.id, pieceId: 'w2-b' }, // P2 chooses furthest warrior
      ];

      const result = resolveStarvation(state, choices);

      // Warriors should be removed
      expect(result.newState.pieces.find((p) => p.id === 'w1-b')).toBeUndefined();
      expect(result.newState.pieces.find((p) => p.id === 'w2-b')).toBeUndefined();

      // Other warriors should remain
      expect(result.newState.pieces.find((p) => p.id === 'w1-a')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'w2-a')).toBeDefined();

      // Jarls should remain
      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'jarl-2')).toBeDefined();
    });

    it('should generate ELIMINATED events for each removed warrior', () => {
      const state = createStarvationTestState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-b' },
        { playerId: p2.id, pieceId: 'w2-b' },
      ];

      const result = resolveStarvation(state, choices);

      const eliminatedEvents = result.events.filter((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvents).toHaveLength(2);

      const w1bEvent = eliminatedEvents.find(
        (e) => e.type === 'ELIMINATED' && e.pieceId === 'w1-b'
      );
      expect(w1bEvent).toBeDefined();
      expect(w1bEvent!.type === 'ELIMINATED' && w1bEvent!.cause).toBe('starvation');

      const w2bEvent = eliminatedEvents.find(
        (e) => e.type === 'ELIMINATED' && e.pieceId === 'w2-b'
      );
      expect(w2bEvent).toBeDefined();
    });

    it('should not end the game when both players still have jarls', () => {
      const state = createStarvationTestState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-b' },
        { playerId: p2.id, pieceId: 'w2-b' },
      ];

      const result = resolveStarvation(state, choices);

      expect(result.gameEnded).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('counter resets to 0', () => {
    it('should reset roundsSinceElimination to 0 after starvation', () => {
      const state = createStarvationTestState();
      expect(state.roundsSinceElimination).toBe(10);

      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-b' },
        { playerId: p2.id, pieceId: 'w2-b' },
      ];

      const result = resolveStarvation(state, choices);

      expect(result.newState.roundsSinceElimination).toBe(0);
    });
  });

  describe('last standing victory triggered by starvation', () => {
    it('should trigger last standing victory when starvation removes the last jarl-owning player pieces leading to only one jarl', () => {
      const state = createInitialState(['Alice', 'Bob']);
      state.phase = 'playing';
      state.roundsSinceElimination = 10;

      const p1 = state.players[0];
      const p2 = state.players[1];

      // Set up: P2 has only 1 warrior (will be removed), P2's jarl gets eliminated
      // Actually, starvation removes warriors, not jarls. For last standing:
      // We need a scenario where after starvation, only one jarl remains.
      // This can't happen through warrior starvation alone since jarls aren't removed.
      // Let's set up P2 with no jarl (already missing from pieces) and one warrior.
      const shields = state.pieces.filter((p) => p.type === 'shield');
      state.pieces = [
        { id: 'jarl-1', type: 'jarl', playerId: p1.id, position: { q: 3, r: 0 } },
        // No jarl for P2 - already eliminated from board somehow
        { id: 'w1-a', type: 'warrior', playerId: p1.id, position: { q: 2, r: -1 } },
        { id: 'w2-a', type: 'warrior', playerId: p2.id, position: { q: -2, r: 1 } },
        ...shields,
      ];

      // Before starvation: 1 jarl on board (only P1's)
      // checkLastStanding would already return victory for P1
      // So this tests that resolveStarvation detects it after removing warriors

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-a' },
        { playerId: p2.id, pieceId: 'w2-a' },
      ];

      const result = resolveStarvation(state, choices);

      // Only one jarl remains (P1's) -> last standing victory
      expect(result.gameEnded).toBe(true);
      expect(result.winnerId).toBe(p1.id);
      expect(result.newState.phase).toBe('ended');
      expect(result.newState.winCondition).toBe('lastStanding');
    });
  });

  describe('invalid choice handling', () => {
    it('should fallback to first candidate when an invalid piece is chosen', () => {
      const state = createStarvationTestState();
      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'nonexistent-piece' }, // Invalid
        { playerId: p2.id, pieceId: 'w2-b' }, // Valid
      ];

      const result = resolveStarvation(state, choices);

      // P1's first candidate (w1-b, the furthest) should be used as fallback
      expect(result.newState.pieces.find((p) => p.id === 'w1-b')).toBeUndefined();
      expect(result.newState.pieces.find((p) => p.id === 'w2-b')).toBeUndefined();
    });

    it('should auto-select first candidate for players who did not submit a choice', () => {
      const state = createStarvationTestState();
      const p2 = state.players[1];

      // Only P2 submits a choice
      const choices: StarvationChoice[] = [{ playerId: p2.id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      // P1's first candidate should be auto-selected
      expect(result.newState.pieces.find((p) => p.id === 'w1-b')).toBeUndefined();
      // P2's choice should be honored
      expect(result.newState.pieces.find((p) => p.id === 'w2-b')).toBeUndefined();
    });
  });

  describe('players with no warriors', () => {
    it('should skip players who have no warriors', () => {
      const state = createInitialState(['Alice', 'Bob']);
      state.phase = 'playing';
      state.roundsSinceElimination = 10;

      const p1 = state.players[0];
      const p2 = state.players[1];

      // P1 has no warriors, P2 has one
      const shields = state.pieces.filter((p) => p.type === 'shield');
      state.pieces = [
        { id: 'jarl-1', type: 'jarl', playerId: p1.id, position: { q: 3, r: 0 } },
        { id: 'jarl-2', type: 'jarl', playerId: p2.id, position: { q: -3, r: 0 } },
        { id: 'w2-a', type: 'warrior', playerId: p2.id, position: { q: -2, r: 1 } },
        ...shields,
      ];

      const choices: StarvationChoice[] = [{ playerId: p2.id, pieceId: 'w2-a' }];

      const result = resolveStarvation(state, choices);

      // Only P2's warrior should be removed
      const eliminatedEvents = result.events.filter((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvents).toHaveLength(1);
      expect(result.newState.pieces.find((p) => p.id === 'w2-a')).toBeUndefined();

      // Both jarls should remain
      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
      expect(result.newState.pieces.find((p) => p.id === 'jarl-2')).toBeDefined();
    });
  });

  describe('does not mutate original state', () => {
    it('should not modify the input state object', () => {
      const state = createStarvationTestState();
      const originalPieceCount = state.pieces.length;
      const originalRoundsSince = state.roundsSinceElimination;

      const p1 = state.players[0];
      const p2 = state.players[1];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-b' },
        { playerId: p2.id, pieceId: 'w2-b' },
      ];

      resolveStarvation(state, choices);

      // Original state should be unchanged
      expect(state.pieces.length).toBe(originalPieceCount);
      expect(state.roundsSinceElimination).toBe(originalRoundsSince);
    });
  });
});
