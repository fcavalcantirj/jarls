import { resolvePush, GameState, Piece, PushEvent } from '../index';

describe('resolvePush', () => {
  // Helper function to create a minimal game state with specific pieces
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        shieldCount: 0,
        warriorCount: 0,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 0,
      roundNumber: 0,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('routing to correct resolution function', () => {
    it('should route to resolveSimplePush when chain terminates at empty hex', () => {
      // Attacker at q=0, defender at q=1, empty hex at q=2
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -1, r: 0 }, // Attacker from position
        { q: 1, r: 0 }, // Defender position
        0, // Push East
        true // Has momentum
      );

      // Verify simple push behavior: defender moved, attacker took defender's spot
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      const defenderInNewState = result.newState.pieces.find((p) => p.id === 'defender');

      expect(attackerInNewState?.position).toEqual({ q: 1, r: 0 });
      expect(defenderInNewState?.position).toEqual({ q: 2, r: 0 });
      expect(result.eliminatedPieceIds).toHaveLength(0);
    });

    it('should route to resolveEdgePush when chain terminates at board edge', () => {
      // Attacker at q=2, defender at edge q=3
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

      const result = resolvePush(
        state,
        'attacker',
        { q: 1, r: 0 }, // Attacker from position
        { q: 3, r: 0 }, // Defender position (at edge)
        0, // Push East
        true // Has momentum
      );

      // Verify edge push behavior: defender eliminated, attacker took position
      expect(result.eliminatedPieceIds).toContain('defender');
      expect(result.eliminatedPieceIds).toHaveLength(1);

      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 3, r: 0 });

      // Defender should be removed
      const defenderInNewState = result.newState.pieces.find((p) => p.id === 'defender');
      expect(defenderInNewState).toBeUndefined();
    });

    it('should route to resolveCompression when chain terminates at shield', () => {
      // Attacker at q=-1, defender at q=0, shield at q=1
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const shield: Piece = {
        id: 'shield',
        type: 'shield',
        playerId: null,
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender, shield]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -2, r: 0 }, // Attacker from position
        { q: 0, r: 0 }, // Defender position
        0, // Push East
        false // No momentum
      );

      // Verify compression behavior: no eliminations
      expect(result.eliminatedPieceIds).toHaveLength(0);
      expect(result.newState.pieces).toHaveLength(3);

      // When defender can't move (blocked by shield), attacker stays at attackerFrom
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: -2, r: 0 }); // Stays at attackerFrom
    });

    it('should route to resolveCompression when chain terminates at throne', () => {
      // Defender adjacent to throne, pushed toward it
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
        position: { q: 1, r: 0 }, // Adjacent to throne
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(
        state,
        'attacker',
        { q: 3, r: 0 }, // Attacker from position
        { q: 1, r: 0 }, // Defender position
        3, // Push West (toward throne at 0,0)
        false
      );

      // Verify compression behavior: no eliminations
      expect(result.eliminatedPieceIds).toHaveLength(0);

      // When defender can't move (no room for compression - adjacent to throne),
      // attacker stays at attackerFrom to prevent duplicate positions bug
      const attackerInNewState = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attackerInNewState?.position).toEqual({ q: 3, r: 0 }); // Stays at attackerFrom
    });
  });

  describe('chain detection and events', () => {
    it('should detect and resolve multi-piece chain to empty hex', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender1: Piece = {
        id: 'defender1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const defender2: Piece = {
        id: 'defender2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender1, defender2]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0, // Push East
        true
      );

      // No eliminations (empty hex terminator)
      expect(result.eliminatedPieceIds).toHaveLength(0);

      // All pieces should have moved
      const attackerPos = result.newState.pieces.find((p) => p.id === 'attacker')?.position;
      const d1Pos = result.newState.pieces.find((p) => p.id === 'defender1')?.position;
      const d2Pos = result.newState.pieces.find((p) => p.id === 'defender2')?.position;

      expect(attackerPos).toEqual({ q: 0, r: 0 });
      expect(d1Pos).toEqual({ q: 1, r: 0 });
      expect(d2Pos).toEqual({ q: 2, r: 0 });
    });

    it('should detect and resolve multi-piece chain to edge with elimination', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const defender1: Piece = {
        id: 'defender1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const defender2: Piece = {
        id: 'defender2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 }, // At edge
      };
      const state = createTestState([attacker, defender1, defender2]);

      const result = resolvePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 2, r: 0 },
        0, // Push East
        true
      );

      // defender2 at edge should be eliminated
      expect(result.eliminatedPieceIds).toContain('defender2');
      expect(result.eliminatedPieceIds).toHaveLength(1);

      // defender1 should move to defender2's old position
      const d1Pos = result.newState.pieces.find((p) => p.id === 'defender1')?.position;
      expect(d1Pos).toEqual({ q: 3, r: 0 });

      // attacker should take defender1's old position
      const attackerPos = result.newState.pieces.find((p) => p.id === 'attacker')?.position;
      expect(attackerPos).toEqual({ q: 2, r: 0 });
    });

    it('should generate MOVE event for attacker', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, true);

      const moveEvent = result.events.find((e) => e.type === 'MOVE');
      expect(moveEvent).toBeDefined();
      if (moveEvent?.type === 'MOVE') {
        expect(moveEvent.pieceId).toBe('attacker');
        expect(moveEvent.from).toEqual({ q: -1, r: 0 });
        expect(moveEvent.to).toEqual({ q: 1, r: 0 });
        expect(moveEvent.hasMomentum).toBe(true);
      }
    });

    it('should generate PUSH events with correct depth for animation', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender1: Piece = {
        id: 'defender1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const defender2: Piece = {
        id: 'defender2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender1, defender2]);

      const result = resolvePush(state, 'attacker', { q: -2, r: 0 }, { q: 0, r: 0 }, 0, false);

      const pushEvents = result.events.filter((e) => e.type === 'PUSH') as PushEvent[];
      expect(pushEvents.length).toBeGreaterThanOrEqual(1);

      // First push event should have depth 0
      const firstPush = pushEvents.find((e) => e.pieceId === 'defender1');
      expect(firstPush?.depth).toBe(0);

      // Second push event should have depth 1
      const secondPush = pushEvents.find((e) => e.pieceId === 'defender2');
      expect(secondPush?.depth).toBe(1);
    });

    it('should generate ELIMINATED event when piece pushed off edge', () => {
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

      const result = resolvePush(state, 'attacker', { q: 1, r: 0 }, { q: 3, r: 0 }, 0, true);

      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvent).toBeDefined();
      if (eliminatedEvent?.type === 'ELIMINATED') {
        expect(eliminatedEvent.pieceId).toBe('defender');
        expect(eliminatedEvent.cause).toBe('edge');
      }
    });
  });

  describe('different push directions', () => {
    it('should handle West (direction 3) push', () => {
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
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(
        state,
        'attacker',
        { q: 2, r: 0 },
        { q: 0, r: 0 },
        3, // West
        false
      );

      const attackerPos = result.newState.pieces.find((p) => p.id === 'attacker')?.position;
      const defenderPos = result.newState.pieces.find((p) => p.id === 'defender')?.position;

      expect(attackerPos).toEqual({ q: 0, r: 0 });
      expect(defenderPos).toEqual({ q: -1, r: 0 });
    });

    it('should handle Northeast (direction 1) push', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 1 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -1, r: 2 },
        { q: 1, r: 0 },
        1, // Northeast
        false
      );

      const attackerPos = result.newState.pieces.find((p) => p.id === 'attacker')?.position;
      const defenderPos = result.newState.pieces.find((p) => p.id === 'defender')?.position;

      expect(attackerPos).toEqual({ q: 1, r: 0 });
      expect(defenderPos).toEqual({ q: 2, r: -1 }); // Northeast of (1,0)
    });

    it('should handle Southwest (direction 4) push to edge', () => {
      // Defender at Southwest edge
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 2 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -3, r: 3 }, // At Southwest edge
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -1, r: 1 },
        { q: -3, r: 3 },
        4, // Southwest
        false
      );

      expect(result.eliminatedPieceIds).toContain('defender');
    });
  });

  describe('mixed allegiance chains', () => {
    it('should handle chain with pieces from both players', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const p2Warrior: Piece = {
        id: 'p2-w',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const p1Warrior: Piece = {
        id: 'p1-w',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, p2Warrior, p1Warrior]);

      const result = resolvePush(
        state,
        'attacker',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0, // East
        false
      );

      // All pieces should move
      const attackerPos = result.newState.pieces.find((p) => p.id === 'attacker')?.position;
      const p2Pos = result.newState.pieces.find((p) => p.id === 'p2-w')?.position;
      const p1Pos = result.newState.pieces.find((p) => p.id === 'p1-w')?.position;

      expect(attackerPos).toEqual({ q: 0, r: 0 });
      expect(p2Pos).toEqual({ q: 1, r: 0 });
      expect(p1Pos).toEqual({ q: 2, r: 0 });
    });
  });

  describe('Jarl scenarios', () => {
    it('should handle Jarl being pushed off edge (elimination)', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const enemyJarl: Piece = {
        id: 'enemy-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 3, r: 0 }, // At edge
      };
      const state = createTestState([attacker, enemyJarl]);

      const result = resolvePush(
        state,
        'attacker',
        { q: 1, r: 0 },
        { q: 3, r: 0 },
        0, // East
        true
      );

      expect(result.eliminatedPieceIds).toContain('enemy-jarl');

      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      if (eliminatedEvent?.type === 'ELIMINATED') {
        expect(eliminatedEvent.pieceId).toBe('enemy-jarl');
        expect(eliminatedEvent.playerId).toBe('p2');
      }
    });

    it('should handle Jarl compression against throne (no victory)', () => {
      // Jarl adjacent to throne, pushed toward it - should compress
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const enemyJarl: Piece = {
        id: 'enemy-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 }, // Adjacent to throne
      };
      const state = createTestState([attacker, enemyJarl]);

      const result = resolvePush(
        state,
        'attacker',
        { q: 3, r: 0 },
        { q: 1, r: 0 },
        3, // West toward throne
        false
      );

      // No elimination - Jarl compresses against throne
      expect(result.eliminatedPieceIds).toHaveLength(0);

      // Jarl should still be in the game
      const jarlInNewState = result.newState.pieces.find((p) => p.id === 'enemy-jarl');
      expect(jarlInNewState).toBeDefined();
    });
  });

  describe('state immutability', () => {
    it('should not modify the original state', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const originalPieces = [{ ...attacker }, { ...defender }];
      const state = createTestState([attacker, defender]);

      resolvePush(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, false);

      // Original state should be unchanged
      expect(state.pieces[0].position).toEqual(originalPieces[0].position);
      expect(state.pieces[1].position).toEqual(originalPieces[1].position);
    });
  });

  describe('return value structure', () => {
    it('should return correct PushResult structure', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolvePush(state, 'attacker', { q: -1, r: 0 }, { q: 1, r: 0 }, 0, false);

      // Check structure
      expect(result).toHaveProperty('newState');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('eliminatedPieceIds');

      expect(result.newState).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(Array.isArray(result.eliminatedPieceIds)).toBe(true);
    });
  });
});
