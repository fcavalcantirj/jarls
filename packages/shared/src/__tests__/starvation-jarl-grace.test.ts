import { resolveStarvation, incrementJarlGracePeriods, createInitialState } from '../index';
import type { GameState, StarvationChoice } from '../types';

/**
 * Helper to create a game state where a player has no warriors
 * and a specific grace period counter.
 */
function createJarlGraceState(opts: {
  p1RoundsSinceLastWarrior: number | null;
  p2RoundsSinceLastWarrior: number | null;
  p1HasWarriors: boolean;
  p2HasWarriors: boolean;
}): GameState {
  const state = createInitialState(['Alice', 'Bob']);
  state.phase = 'playing';
  state.roundsSinceElimination = 10; // At starvation trigger point

  const p1 = state.players[0];
  const p2 = state.players[1];

  // Set grace period counters
  state.players = state.players.map((p) => {
    if (p.id === p1.id) return { ...p, roundsSinceLastWarrior: opts.p1RoundsSinceLastWarrior };
    if (p.id === p2.id) return { ...p, roundsSinceLastWarrior: opts.p2RoundsSinceLastWarrior };
    return p;
  });

  const shields = state.pieces.filter((p) => p.type === 'shield');
  const pieces = [
    { id: 'jarl-1', type: 'jarl' as const, playerId: p1.id, position: { q: 3, r: 0 } },
    { id: 'jarl-2', type: 'jarl' as const, playerId: p2.id, position: { q: -3, r: 0 } },
    ...shields,
  ];

  if (opts.p1HasWarriors) {
    pieces.push(
      { id: 'w1-a', type: 'warrior' as const, playerId: p1.id, position: { q: 2, r: -1 } },
      { id: 'w1-b', type: 'warrior' as const, playerId: p1.id, position: { q: 2, r: 0 } }
    );
  }
  if (opts.p2HasWarriors) {
    pieces.push(
      { id: 'w2-a', type: 'warrior' as const, playerId: p2.id, position: { q: -2, r: 1 } },
      { id: 'w2-b', type: 'warrior' as const, playerId: p2.id, position: { q: -2, r: 0 } }
    );
  }

  state.pieces = pieces;
  return state;
}

describe('Jarl starvation grace period', () => {
  describe('Jarl survives during 5-round grace period', () => {
    it('should NOT eliminate Jarl when roundsSinceLastWarrior < 5', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 3, // Only 3 rounds without warriors
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      // P1's Jarl should still be alive
      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
      // P1 should not be eliminated
      const p1 = result.newState.players.find((p) => p.id === state.players[0].id)!;
      expect(p1.isEliminated).toBe(false);
    });

    it('should NOT eliminate Jarl at exactly 4 rounds (boundary)', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 4,
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
    });

    it('should NOT eliminate Jarl when roundsSinceLastWarrior is null', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: null,
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
    });

    it('should NOT eliminate Jarl when roundsSinceLastWarrior is 0', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 0,
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeDefined();
    });
  });

  describe('Jarl eliminated after grace period expires', () => {
    it('should eliminate Jarl when roundsSinceLastWarrior >= 5', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 5, // Grace period expired
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      // P1's Jarl should be removed
      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeUndefined();
      // P1 should be marked as eliminated
      const p1 = result.newState.players.find((p) => p.id === state.players[0].id)!;
      expect(p1.isEliminated).toBe(true);
    });

    it('should generate JARL_STARVED event when Jarl is eliminated', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 5,
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      const jarlStarvedEvents = result.events.filter((e) => e.type === 'JARL_STARVED');
      expect(jarlStarvedEvents).toHaveLength(1);
      expect(jarlStarvedEvents[0]).toMatchObject({
        type: 'JARL_STARVED',
        pieceId: 'jarl-1',
        playerId: state.players[0].id,
      });
    });

    it('should trigger last standing victory when Jarl starvation leaves one player', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 5, // P1's Jarl will be eliminated
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      expect(result.gameEnded).toBe(true);
      expect(result.winnerId).toBe(state.players[1].id);
      expect(result.newState.winCondition).toBe('lastStanding');
    });

    it('should eliminate Jarl at roundsSinceLastWarrior = 7 (well past grace period)', () => {
      const state = createJarlGraceState({
        p1RoundsSinceLastWarrior: 7,
        p2RoundsSinceLastWarrior: null,
        p1HasWarriors: false,
        p2HasWarriors: true,
      });

      const choices: StarvationChoice[] = [{ playerId: state.players[1].id, pieceId: 'w2-b' }];

      const result = resolveStarvation(state, choices);

      expect(result.newState.pieces.find((p) => p.id === 'jarl-1')).toBeUndefined();
    });
  });

  describe('grace period tracking on warrior loss', () => {
    it('should set roundsSinceLastWarrior to 0 when player loses last warrior via starvation', () => {
      // P1 has exactly 1 warrior, P2 has 2
      const state = createInitialState(['Alice', 'Bob']);
      state.phase = 'playing';
      state.roundsSinceElimination = 10;

      const p1 = state.players[0];
      const p2 = state.players[1];

      const shields = state.pieces.filter((p) => p.type === 'shield');
      state.pieces = [
        { id: 'jarl-1', type: 'jarl', playerId: p1.id, position: { q: 3, r: 0 } },
        { id: 'jarl-2', type: 'jarl', playerId: p2.id, position: { q: -3, r: 0 } },
        // P1 has only 1 warrior (will be removed by starvation)
        { id: 'w1-only', type: 'warrior', playerId: p1.id, position: { q: 3, r: -1 } },
        // P2 has 2 warriors
        { id: 'w2-a', type: 'warrior', playerId: p2.id, position: { q: -2, r: 1 } },
        { id: 'w2-b', type: 'warrior', playerId: p2.id, position: { q: -3, r: 1 } },
        ...shields,
      ];

      const choices: StarvationChoice[] = [
        { playerId: p1.id, pieceId: 'w1-only' },
        { playerId: p2.id, pieceId: 'w2-b' },
      ];

      const result = resolveStarvation(state, choices);

      // P1 should now have roundsSinceLastWarrior = 0 (just lost last warrior)
      const updatedP1 = result.newState.players.find((p) => p.id === p1.id)!;
      expect(updatedP1.roundsSinceLastWarrior).toBe(0);

      // P2 still has warriors - should remain null
      const updatedP2 = result.newState.players.find((p) => p.id === p2.id)!;
      expect(updatedP2.roundsSinceLastWarrior).toBeNull();
    });
  });
});

describe('incrementJarlGracePeriods', () => {
  it('should increment roundsSinceLastWarrior for players with no warriors', () => {
    const state = createJarlGraceState({
      p1RoundsSinceLastWarrior: 2,
      p2RoundsSinceLastWarrior: null,
      p1HasWarriors: false,
      p2HasWarriors: true,
    });

    const newState = incrementJarlGracePeriods(state);

    const p1 = newState.players.find((p) => p.id === state.players[0].id)!;
    expect(p1.roundsSinceLastWarrior).toBe(3);

    const p2 = newState.players.find((p) => p.id === state.players[1].id)!;
    expect(p2.roundsSinceLastWarrior).toBeNull();
  });

  it('should not increment for players who still have warriors', () => {
    const state = createJarlGraceState({
      p1RoundsSinceLastWarrior: null,
      p2RoundsSinceLastWarrior: null,
      p1HasWarriors: true,
      p2HasWarriors: true,
    });

    const newState = incrementJarlGracePeriods(state);

    const p1 = newState.players.find((p) => p.id === state.players[0].id)!;
    expect(p1.roundsSinceLastWarrior).toBeNull();
  });

  it('should start tracking at 1 for a player with no warriors and null counter', () => {
    const state = createJarlGraceState({
      p1RoundsSinceLastWarrior: null,
      p2RoundsSinceLastWarrior: null,
      p1HasWarriors: false,
      p2HasWarriors: true,
    });

    const newState = incrementJarlGracePeriods(state);

    const p1 = newState.players.find((p) => p.id === state.players[0].id)!;
    expect(p1.roundsSinceLastWarrior).toBe(1);
  });

  it('should reset counter if player somehow has warriors again', () => {
    const state = createJarlGraceState({
      p1RoundsSinceLastWarrior: 3,
      p2RoundsSinceLastWarrior: null,
      p1HasWarriors: true, // Has warriors despite counter being set
      p2HasWarriors: true,
    });

    const newState = incrementJarlGracePeriods(state);

    const p1 = newState.players.find((p) => p.id === state.players[0].id)!;
    expect(p1.roundsSinceLastWarrior).toBeNull();
  });

  it('should not modify eliminated players', () => {
    const state = createJarlGraceState({
      p1RoundsSinceLastWarrior: 3,
      p2RoundsSinceLastWarrior: null,
      p1HasWarriors: false,
      p2HasWarriors: true,
    });

    // Eliminate P1
    state.players = state.players.map((p) =>
      p.id === state.players[0].id ? { ...p, isEliminated: true } : p
    );

    const newState = incrementJarlGracePeriods(state);

    const p1 = newState.players.find((p) => p.id === state.players[0].id)!;
    // Should remain unchanged (still 3, not incremented)
    expect(p1.roundsSinceLastWarrior).toBe(3);
  });
});
