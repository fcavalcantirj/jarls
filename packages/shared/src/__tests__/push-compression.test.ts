import { resolveCompression, GameState, Piece, ChainResult, PushEvent } from '../index';

describe('resolveCompression', () => {
  // Helper function to create a minimal game state with specific pieces
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        warriorCount: 0,
        turnTimerMs: null,
        terrain: 'calm',
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
      ],
      pieces,
      holes: [],
      currentPlayerId: 'p1',
      turnNumber: 0,
      roundNumber: 0,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
      moveHistory: [],
    };
  }

  describe('throne compression', () => {
    it('should compress a Warrior against the throne', () => {
      // Warrior at q=1, throne at q=0. Attacker pushes from q=2 toward West
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 }, // Throne at center
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3, // Push West
        true,
        chain
      );

      // No pieces eliminated
      expect(result.newState.pieces).toHaveLength(2);

      // When defender can't move (adjacent to throne), attacker stays at attackerFrom
      // This prevents duplicate positions bug
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 3, r: 0 }); // Stays at attackerFrom

      // Defender cannot enter throne, stays put
      const defenderInNewState = result.newState.pieces.find((p) => p.id === 'defender');
      expect(defenderInNewState?.position).toEqual({ q: 1, r: 0 });
    });

    it('should compress a Jarl against the throne (Jarl cannot be pushed onto throne)', () => {
      // Jarl at q=1, throne at q=0. Attacker pushes from q=2 toward West
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defenderJarl: Piece = {
        id: 'defender-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defenderJarl]);

      const chain: ChainResult = {
        pieces: [defenderJarl],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3, // Push West
        true,
        chain
      );

      // No pieces eliminated - Jarl compresses at throne
      expect(result.newState.pieces).toHaveLength(2);

      // Jarl should not be on the throne (cannot be pushed onto it)
      const jarlInNewState = result.newState.pieces.find((p) => p.id === 'defender-jarl');
      expect(jarlInNewState?.position).not.toEqual({ q: 0, r: 0 });
    });

    it('should not trigger victory when Jarl is pushed toward throne (compression)', () => {
      // This tests that a pushed Jarl doesn't win by being pushed onto throne
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defenderJarl: Piece = {
        id: 'defender-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defenderJarl]);

      const chain: ChainResult = {
        pieces: [defenderJarl],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3,
        true,
        chain
      );

      // Game should not end - no GAME_ENDED event
      const gameEndedEvent = result.events.find((e) => e.type === 'GAME_ENDED');
      expect(gameEndedEvent).toBeUndefined();
    });

    it('should compress multiple Warriors against throne', () => {
      // Chain: W1 at q=2, W2 at q=1 (adjacent to throne). Attacker pushes from q=3
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 3, r: 0 },
      };
      const w1: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const w2: Piece = {
        id: 'w2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, w1, w2]);

      const chain: ChainResult = {
        pieces: [w1, w2],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        3, // Push West
        false,
        chain
      );

      // No pieces eliminated
      expect(result.newState.pieces).toHaveLength(3);
    });
  });

  describe('event generation', () => {
    it('should generate MOVE event for attacker', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 }, // Attacker came from q=3 (momentum)
        { q: 1, r: 0 },
        3,
        true,
        chain
      );

      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.pieceId).toBe('attacker');
        expect(moveEvent.from).toEqual({ q: 3, r: 0 });
        // When defender can't move (no room), attacker stays at attackerFrom
        expect(moveEvent.to).toEqual({ q: 3, r: 0 });
        expect(moveEvent.hasMomentum).toBe(true);
      }
    });

    it('should generate PUSH events for chain pieces that can move', () => {
      // Chain: W1 at q=2, W2 at q=1 (adjacent to throne)
      // W1 can move to q=1, W2 cannot move (blocked by throne at q=0)
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 3, r: 0 },
      };
      const w1: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const w2: Piece = {
        id: 'w2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, w1, w2]);

      const chain: ChainResult = {
        pieces: [w1, w2],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 2, r: 0 },
        3,
        false,
        chain
      );

      // W1 can move to q=1, W2 cannot move (blocked by throne at q=0)
      const pushEvents = result.events.filter((e) => e.type === 'PUSH');
      expect(pushEvents.length).toBeGreaterThanOrEqual(1);

      // W1 should have a PUSH event (from q=2 to q=1)
      const w1PushEvent = pushEvents.find(
        (e) => e.type === 'PUSH' && (e as PushEvent).pieceId === 'w1'
      );
      expect(w1PushEvent).toBeDefined();
      if (w1PushEvent?.type === 'PUSH') {
        expect(w1PushEvent.from).toEqual({ q: 2, r: 0 });
        expect(w1PushEvent.to).toEqual({ q: 1, r: 0 });
        expect(w1PushEvent.depth).toBe(0);
      }
    });

    it('should not generate PUSH event for piece adjacent to blocker', () => {
      // Single piece adjacent to throne - no room to move
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 2, r: 0 },
        { q: 1, r: 0 },
        3,
        false,
        chain
      );

      // Only MOVE event for attacker, no PUSH event since defender can't move
      const pushEvents = result.events.filter((e) => e.type === 'PUSH');
      expect(pushEvents).toHaveLength(0);

      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
    });
  });

  describe('state immutability', () => {
    it('should not modify the original state', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      // Save original positions
      const originalAttackerPos = { ...attacker.position };
      const originalDefenderPos = { ...defender.position };

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      resolveCompression(state, 'attacker', { q: 3, r: 0 }, { q: 1, r: 0 }, 3, true, chain);

      // Original state should be unchanged
      const attackerInOriginal = state.pieces.find((p) => p.id === 'attacker');
      const defenderInOriginal = state.pieces.find((p) => p.id === 'defender');

      expect(attackerInOriginal?.position).toEqual(originalAttackerPos);
      expect(defenderInOriginal?.position).toEqual(originalDefenderPos);
    });

    it('should preserve bystander pieces unchanged', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const bystander: Piece = {
        id: 'bystander',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 1 },
      };
      const state = createTestState([attacker, defender, bystander]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'throne',
        terminatorPosition: { q: 0, r: 0 },
      };

      const result = resolveCompression(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3,
        true,
        chain
      );

      // Bystander should be unchanged
      const bystanderInNewState = result.newState.pieces.find((p) => p.id === 'bystander');
      expect(bystanderInNewState?.position).toEqual({ q: -2, r: 1 });
    });
  });
});
