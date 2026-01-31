import { resolveEdgePush, GameState, Piece, ChainResult } from '../index';

describe('resolveEdgePush', () => {
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

  describe('single piece elimination', () => {
    it('should eliminate a single piece pushed off the edge', () => {
      // Attacker at q=2, defender at edge q=3, pushing East
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
        position: { q: 3, r: 0 }, // At edge (radius 3)
      };
      const state = createTestState([attacker, defender]);

      // Create a chain for the defender being pushed East
      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 }, // Beyond edge
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 1, r: 0 }, // Attacker came from q=1 (moved 2 hexes for momentum)
        { q: 3, r: 0 }, // Defender position
        0, // Push East
        true, // Has momentum
        chain
      );

      // Defender should be eliminated
      expect(result.eliminatedPieceIds).toContain('defender');
      expect(result.eliminatedPieceIds).toHaveLength(1);

      // Attacker should move to defender's position
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 3, r: 0 });

      // Defender should be removed from pieces
      const defenderInNewState = result.newState.pieces.find((p) => p.id === 'defender');
      expect(defenderInNewState).toBeUndefined();
    });

    it('should generate ELIMINATED event for piece pushed off edge', () => {
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
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 2, r: 0 },
        { q: 3, r: 0 },
        0,
        false,
        chain
      );

      // Find ELIMINATED event
      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvent).toBeDefined();
      expect(eliminatedEvent?.type).toBe('ELIMINATED');
      if (eliminatedEvent?.type === 'ELIMINATED') {
        expect(eliminatedEvent.pieceId).toBe('defender');
        expect(eliminatedEvent.playerId).toBe('p2');
        expect(eliminatedEvent.position).toEqual({ q: 3, r: 0 });
        expect(eliminatedEvent.cause).toBe('edge');
      }
    });

    it('should generate MOVE event for attacker', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 1, r: 0 }, // Moved 2 hexes (momentum)
        { q: 3, r: 0 },
        0,
        true,
        chain
      );

      // Find MOVE event
      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.pieceId).toBe('attacker');
        expect(moveEvent.from).toEqual({ q: 1, r: 0 });
        expect(moveEvent.to).toEqual({ q: 3, r: 0 });
        expect(moveEvent.hasMomentum).toBe(true);
      }
    });
  });

  describe('chain compression', () => {
    it('should compress a 2-piece chain when last piece is eliminated', () => {
      // Chain: W1 at q=2, W2 at q=3 (edge). Push East eliminates W2, W1 moves to q=3
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
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
        position: { q: 3, r: 0 }, // At edge
      };
      const state = createTestState([attacker, w1, w2]);

      const chain: ChainResult = {
        pieces: [w1, w2],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 2, r: 0 }, // First piece in chain
        0, // Push East
        false,
        chain
      );

      // W2 should be eliminated
      expect(result.eliminatedPieceIds).toEqual(['w2']);

      // W1 should move to W2's position (q=3)
      const w1InNewState = result.newState.pieces.find((p) => p.id === 'w1');
      expect(w1InNewState?.position).toEqual({ q: 3, r: 0 });

      // Attacker should move to W1's original position (q=2)
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 2, r: 0 });
    });

    it('should compress a 3-piece chain when last piece is eliminated', () => {
      // Chain: W1 at q=1, W2 at q=2, W3 at q=3 (edge). Push East eliminates W3
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const w1: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const w2: Piece = {
        id: 'w2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const w3: Piece = {
        id: 'w3',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 }, // At edge
      };
      const state = createTestState([attacker, w1, w2, w3]);

      const chain: ChainResult = {
        pieces: [w1, w2, w3],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 1, r: 0 },
        0,
        false,
        chain
      );

      // W3 should be eliminated
      expect(result.eliminatedPieceIds).toEqual(['w3']);

      // W1 moves to q=2, W2 moves to q=3
      expect(result.newState.pieces.find((p) => p.id === 'w1')?.position).toEqual({ q: 2, r: 0 });
      expect(result.newState.pieces.find((p) => p.id === 'w2')?.position).toEqual({ q: 3, r: 0 });

      // Attacker moves to q=1
      expect(result.newState.pieces.find((p) => p.id === 'attacker')?.position).toEqual({
        q: 1,
        r: 0,
      });
    });

    it('should generate PUSH events with correct depth for chain pieces', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const w1: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const w2: Piece = {
        id: 'w2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const w3: Piece = {
        id: 'w3',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, w1, w2, w3]);

      const chain: ChainResult = {
        pieces: [w1, w2, w3],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 1, r: 0 },
        0,
        false,
        chain
      );

      // Should have PUSH events for w1 and w2 (w3 is eliminated, no push event)
      const pushEvents = result.events.filter((e) => e.type === 'PUSH');
      expect(pushEvents).toHaveLength(2);

      // W1 push should have depth 0
      const w1Push = pushEvents.find((e) => e.type === 'PUSH' && e.pieceId === 'w1');
      expect(w1Push).toBeDefined();
      if (w1Push?.type === 'PUSH') {
        expect(w1Push.depth).toBe(0);
        expect(w1Push.from).toEqual({ q: 1, r: 0 });
        expect(w1Push.to).toEqual({ q: 2, r: 0 });
      }

      // W2 push should have depth 1
      const w2Push = pushEvents.find((e) => e.type === 'PUSH' && e.pieceId === 'w2');
      expect(w2Push).toBeDefined();
      if (w2Push?.type === 'PUSH') {
        expect(w2Push.depth).toBe(1);
        expect(w2Push.from).toEqual({ q: 2, r: 0 });
        expect(w2Push.to).toEqual({ q: 3, r: 0 });
      }
    });
  });

  describe('mixed allegiance chains', () => {
    it('should handle chain with alternating player pieces', () => {
      // P1 attacker pushes P2 warrior, then P1 warrior behind them, P2 at edge eliminated
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const p2w1: Piece = {
        id: 'p2w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const p1w1: Piece = {
        id: 'p1w1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const p2w2: Piece = {
        id: 'p2w2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 }, // At edge
      };
      const state = createTestState([attacker, p2w1, p1w1, p2w2]);

      const chain: ChainResult = {
        pieces: [p2w1, p1w1, p2w2],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 1, r: 0 },
        0,
        false,
        chain
      );

      // P2W2 (at edge) should be eliminated
      expect(result.eliminatedPieceIds).toEqual(['p2w2']);

      // All pieces shift appropriately
      expect(result.newState.pieces.find((p) => p.id === 'p2w1')?.position).toEqual({
        q: 2,
        r: 0,
      });
      expect(result.newState.pieces.find((p) => p.id === 'p1w1')?.position).toEqual({
        q: 3,
        r: 0,
      });
      expect(result.newState.pieces.find((p) => p.id === 'attacker')?.position).toEqual({
        q: 1,
        r: 0,
      });
    });
  });

  describe('different directions', () => {
    it('should work when pushing West toward edge', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -3, r: 0 }, // At West edge
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: -4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: -3, r: 0 },
        3, // Push West
        false,
        chain
      );

      expect(result.eliminatedPieceIds).toContain('defender');
      expect(result.newState.pieces.find((p) => p.id === 'attacker')?.position).toEqual({
        q: -3,
        r: 0,
      });
    });

    it('should work when pushing Northeast toward edge', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: -2 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: -3 }, // At NE edge
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 3, r: -4 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 0, r: -1 },
        { q: 2, r: -3 },
        1, // Push Northeast
        false,
        chain
      );

      expect(result.eliminatedPieceIds).toContain('defender');
      expect(result.newState.pieces.find((p) => p.id === 'attacker')?.position).toEqual({
        q: 2,
        r: -3,
      });
    });

    it('should work when pushing Southeast toward edge', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 2 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -1, r: 3 }, // At SE edge (q + r + s = 0: q=-1, r=3, s=-2; distance=3)
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: -1, r: 4 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: -1, r: 1 },
        { q: -1, r: 3 },
        5, // Push Southeast
        false,
        chain
      );

      expect(result.eliminatedPieceIds).toContain('defender');
      expect(result.newState.pieces.find((p) => p.id === 'attacker')?.position).toEqual({
        q: -1,
        r: 3,
      });
    });
  });

  describe('Jarl elimination', () => {
    it('should eliminate a Jarl pushed off the edge', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const defenderJarl: Piece = {
        id: 'jarl-p2',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, defenderJarl]);

      const chain: ChainResult = {
        pieces: [defenderJarl],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 1, r: 0 },
        { q: 3, r: 0 },
        0,
        true,
        chain
      );

      // Jarl should be eliminated
      expect(result.eliminatedPieceIds).toContain('jarl-p2');

      // Eliminated event should have Jarl's player ID
      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      if (eliminatedEvent?.type === 'ELIMINATED') {
        expect(eliminatedEvent.playerId).toBe('p2');
      }
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
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, defender]);
      const originalPieces = [...state.pieces];

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      resolveEdgePush(state, 'attacker', { q: 1, r: 0 }, { q: 3, r: 0 }, 0, true, chain);

      // Original state should be unchanged
      expect(state.pieces).toHaveLength(2);
      expect(state.pieces.find((p) => p.id === 'attacker')?.position).toEqual({ q: 2, r: 0 });
      expect(state.pieces.find((p) => p.id === 'defender')?.position).toEqual({ q: 3, r: 0 });
      expect(state.pieces).toEqual(originalPieces);
    });

    it('should preserve other pieces in the state', () => {
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
        position: { q: 3, r: 0 },
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
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 1, r: 0 },
        { q: 3, r: 0 },
        0,
        true,
        chain
      );

      // Bystander should be unchanged
      const bystanderInNewState = result.newState.pieces.find((p) => p.id === 'bystander');
      expect(bystanderInNewState?.position).toEqual({ q: -2, r: 1 });
    });
  });

  describe('error handling', () => {
    it('should throw error if attacker not found', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 },
      };
      const state = createTestState([defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      expect(() =>
        resolveEdgePush(state, 'nonexistent', { q: 1, r: 0 }, { q: 3, r: 0 }, 0, false, chain)
      ).toThrow('Attacker with ID nonexistent not found');
    });

    it('should throw error if called with non-edge terminator', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const chain: ChainResult = {
        pieces: [defender],
        terminator: 'empty', // Not edge!
        terminatorPosition: { q: 3, r: 0 },
      };

      expect(() =>
        resolveEdgePush(state, 'attacker', { q: 0, r: 0 }, { q: 2, r: 0 }, 0, false, chain)
      ).toThrow(
        "resolveEdgePush called with invalid terminator: empty. Expected 'edge' or 'hole'."
      );
    });
  });

  describe('event ordering', () => {
    it('should have MOVE event before PUSH and ELIMINATED events', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
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
        position: { q: 3, r: 0 },
      };
      const state = createTestState([attacker, w1, w2]);

      const chain: ChainResult = {
        pieces: [w1, w2],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        0,
        false,
        chain
      );

      // MOVE should be first
      expect(result.events[0].type).toBe('MOVE');

      // PUSH should come after MOVE
      const pushIndex = result.events.findIndex((e) => e.type === 'PUSH');
      expect(pushIndex).toBeGreaterThan(0);

      // ELIMINATED should be after MOVE (order relative to PUSH is flexible)
      const eliminatedIndex = result.events.findIndex((e) => e.type === 'ELIMINATED');
      expect(eliminatedIndex).toBeGreaterThan(0);
    });
  });

  describe('game scenarios', () => {
    it('should handle typical combat scenario at edge', () => {
      // P1 Jarl with momentum attacks P2 Warrior at edge
      const jarl: Piece = {
        id: 'jarl-p1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const warrior: Piece = {
        id: 'w-p2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 },
      };
      const state = createTestState([jarl, warrior]);

      const chain: ChainResult = {
        pieces: [warrior],
        terminator: 'edge',
        terminatorPosition: { q: 4, r: 0 },
      };

      const result = resolveEdgePush(
        state,
        'jarl-p1',
        { q: 0, r: 0 }, // Jarl came from center (with draft)
        { q: 3, r: 0 },
        0,
        true, // Had momentum
        chain
      );

      expect(result.eliminatedPieceIds).toEqual(['w-p2']);
      expect(result.newState.pieces.find((p) => p.id === 'jarl-p1')?.position).toEqual({
        q: 3,
        r: 0,
      });

      // Verify events
      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.hasMomentum).toBe(true);
      }
    });
  });
});
