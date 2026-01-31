import {
  resolveSimplePush,
  createInitialState,
  GameState,
  Piece,
  MoveEvent,
  PushEvent,
} from '../index';

describe('resolveSimplePush', () => {
  // Helper function to create a minimal game state with specific pieces
  function createTestState(pieces: Piece[]): GameState {
    return {
      id: 'test-game',
      phase: 'playing',
      config: {
        playerCount: 2,
        boardRadius: 3,
        terrain: 'calm',
        warriorCount: 0,
        turnTimerMs: null,
      },
      players: [
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 1,
      roundNumber: 1,
      firstPlayerIndex: 0,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('defender moves one hex in push direction', () => {
    it('should move defender to next hex in push direction (East)', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 }, // attackerFrom
        { q: 0, r: 0 }, // defenderPosition
        0, // pushDirection (East)
        false
      );

      // Find defender in new state
      const newDefender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(newDefender).toBeDefined();
      expect(newDefender!.position).toEqual({ q: 1, r: 0 }); // Moved East
    });

    it('should move defender to next hex in push direction (West)', () => {
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

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: 1, r: 0 },
        { q: 0, r: 0 },
        3, // pushDirection (West)
        false
      );

      const newDefender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(newDefender!.position).toEqual({ q: -1, r: 0 }); // Moved West
    });

    it('should move defender to next hex in push direction (Northeast)', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 1 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 1 },
        { q: 0, r: 0 },
        1, // pushDirection (Northeast)
        false
      );

      const newDefender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(newDefender!.position).toEqual({ q: 1, r: -1 }); // Moved Northeast
    });

    it('should work when defender is a Jarl', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender: Piece = {
        id: 'defender-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0, // East
        true // with momentum
      );

      const newDefender = result.newState.pieces.find((p) => p.id === 'defender-jarl');
      expect(newDefender!.position).toEqual({ q: 1, r: 0 });
      expect(newDefender!.type).toBe('jarl');
    });
  });

  describe("attacker takes defender's original position", () => {
    it('should move attacker to where defender was', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0, // East
        false
      );

      const newAttacker = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(newAttacker).toBeDefined();
      expect(newAttacker!.position).toEqual({ q: 0, r: 0 }); // Took defender's spot
    });

    it('should work when attacker moved 2 hexes (momentum)', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -2, r: 0 }, // Started 2 away
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -2, r: 0 }, // Original position (2 hexes away)
        { q: 0, r: 0 },
        0,
        true // hasMomentum
      );

      const newAttacker = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(newAttacker!.position).toEqual({ q: 0, r: 0 });
    });

    it('should work when attacker is a Jarl', () => {
      const attacker: Piece = {
        id: 'attacker-jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker-jarl',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0,
        false
      );

      const newAttacker = result.newState.pieces.find((p) => p.id === 'attacker-jarl');
      expect(newAttacker!.position).toEqual({ q: 0, r: 0 });
      expect(newAttacker!.type).toBe('jarl');
    });
  });

  describe('generates MOVE and PUSH events', () => {
    it('should generate MOVE event for attacker', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0,
        false
      );

      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent | undefined;
      expect(moveEvent).toBeDefined();
      expect(moveEvent!.pieceId).toBe('attacker');
      expect(moveEvent!.from).toEqual({ q: -1, r: 0 });
      expect(moveEvent!.to).toEqual({ q: 0, r: 0 });
      expect(moveEvent!.hasMomentum).toBe(false);
    });

    it('should generate PUSH event for defender', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0, // East
        false
      );

      const pushEvent = result.events.find((e) => e.type === 'PUSH') as PushEvent | undefined;
      expect(pushEvent).toBeDefined();
      expect(pushEvent!.pieceId).toBe('defender');
      expect(pushEvent!.from).toEqual({ q: 0, r: 0 });
      expect(pushEvent!.to).toEqual({ q: 1, r: 0 });
      expect(pushEvent!.pushDirection).toBe(0);
      expect(pushEvent!.depth).toBe(0);
    });

    it('should generate exactly 2 events (MOVE and PUSH)', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0,
        false
      );

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('MOVE');
      expect(result.events[1].type).toBe('PUSH');
    });

    it('should correctly set hasMomentum in MOVE event when true', () => {
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
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0,
        true // hasMomentum
      );

      const moveEvent = result.events.find((e) => e.type === 'MOVE') as MoveEvent;
      expect(moveEvent.hasMomentum).toBe(true);
    });

    it('should set depth to 0 for PUSH event (first piece in chain)', () => {
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
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0,
        false
      );

      const pushEvent = result.events.find((e) => e.type === 'PUSH') as PushEvent;
      expect(pushEvent.depth).toBe(0);
    });
  });

  describe('preserves other pieces in game state', () => {
    it('should not modify other pieces in the state', () => {
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
      const bystander: Piece = {
        id: 'bystander',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 2 },
      };
      const shield: Piece = {
        id: 'shield',
        type: 'shield',
        playerId: null,
        position: { q: -2, r: 1 },
      };
      const state = createTestState([attacker, defender, bystander, shield]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -1, r: 0 },
        { q: 0, r: 0 },
        0,
        false
      );

      const newBystander = result.newState.pieces.find((p) => p.id === 'bystander');
      const newShield = result.newState.pieces.find((p) => p.id === 'shield');

      expect(newBystander!.position).toEqual({ q: 2, r: 2 }); // Unchanged
      expect(newShield!.position).toEqual({ q: -2, r: 1 }); // Unchanged
      expect(result.newState.pieces).toHaveLength(4);
    });

    it('should not modify the original state', () => {
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
      const state = createTestState([attacker, defender]);

      const originalAttackerPos = { ...attacker.position };
      const originalDefenderPos = { ...defender.position };

      resolveSimplePush(state, 'attacker', { q: -1, r: 0 }, { q: 0, r: 0 }, 0, false);

      // Original state should be unchanged
      expect(state.pieces.find((p) => p.id === 'attacker')!.position).toEqual(originalAttackerPos);
      expect(state.pieces.find((p) => p.id === 'defender')!.position).toEqual(originalDefenderPos);
    });
  });

  describe('error handling', () => {
    it('should throw error when attacker not found', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([defender]);

      expect(() => {
        resolveSimplePush(state, 'nonexistent', { q: -1, r: 0 }, { q: 0, r: 0 }, 0, false);
      }).toThrow('Attacker with ID nonexistent not found');
    });

    it('should throw error when no defender at position', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const state = createTestState([attacker]);

      expect(() => {
        resolveSimplePush(state, 'attacker', { q: -1, r: 0 }, { q: 0, r: 0 }, 0, false);
      }).toThrow('No defender at position');
    });
  });

  describe('game scenarios', () => {
    it('should handle Warrior with momentum pushing enemy Warrior', () => {
      // Warrior moved 2 hexes into enemy Warrior
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
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: -2, r: 0 },
        { q: 0, r: 0 },
        0, // East
        true
      );

      // Verify final positions
      const newAttacker = result.newState.pieces.find((p) => p.id === 'attacker');
      const newDefender = result.newState.pieces.find((p) => p.id === 'defender');

      expect(newAttacker!.position).toEqual({ q: 0, r: 0 }); // Took defender's spot
      expect(newDefender!.position).toEqual({ q: 1, r: 0 }); // Pushed East

      // Verify events
      expect(result.events).toHaveLength(2);
      const moveEvent = result.events[0] as MoveEvent;
      const pushEvent = result.events[1] as PushEvent;

      expect(moveEvent.from).toEqual({ q: -2, r: 0 });
      expect(moveEvent.to).toEqual({ q: 0, r: 0 });
      expect(moveEvent.hasMomentum).toBe(true);

      expect(pushEvent.from).toEqual({ q: 0, r: 0 });
      expect(pushEvent.to).toEqual({ q: 1, r: 0 });
    });

    it('should handle Jarl pushing enemy Jarl (no momentum)', () => {
      const attacker: Piece = {
        id: 'jarl1',
        type: 'jarl',
        playerId: 'p1',
        position: { q: -1, r: 0 },
      };
      const defender: Piece = {
        id: 'jarl2',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(state, 'jarl1', { q: -1, r: 0 }, { q: 0, r: 0 }, 0, false);

      const newAttacker = result.newState.pieces.find((p) => p.id === 'jarl1');
      const newDefender = result.newState.pieces.find((p) => p.id === 'jarl2');

      expect(newAttacker!.position).toEqual({ q: 0, r: 0 });
      expect(newDefender!.position).toEqual({ q: 1, r: 0 });
      expect(newAttacker!.type).toBe('jarl');
      expect(newDefender!.type).toBe('jarl');
    });

    it('should handle push in diagonal direction (Southwest)', () => {
      const attacker: Piece = {
        id: 'attacker',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 1, r: -1 },
      };
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([attacker, defender]);

      const result = resolveSimplePush(
        state,
        'attacker',
        { q: 1, r: -1 },
        { q: 0, r: 0 },
        4, // Southwest
        false
      );

      const newDefender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(newDefender!.position).toEqual({ q: -1, r: 1 }); // Pushed Southwest

      const pushEvent = result.events.find((e) => e.type === 'PUSH') as PushEvent;
      expect(pushEvent.pushDirection).toBe(4);
    });

    it('should work with actual game state from createInitialState', () => {
      const state = createInitialState(['Player 1', 'Player 2']);
      state.phase = 'playing';

      // Find an attacker and manually position a defender
      const p1Warrior = state.pieces.find(
        (p) => p.type === 'warrior' && p.playerId === state.players[0].id
      )!;
      const p2Warrior = state.pieces.find(
        (p) => p.type === 'warrior' && p.playerId === state.players[1].id
      )!;

      // Manually position for test
      const attackerOriginal = { ...p1Warrior.position };
      const defenderPos = { q: 0, r: 0 }; // Center
      p2Warrior.position = defenderPos;

      // This should not crash
      const result = resolveSimplePush(
        state,
        p1Warrior.id,
        attackerOriginal,
        defenderPos,
        0, // East
        false
      );

      expect(result.newState.pieces).toBeDefined();
      expect(result.events).toHaveLength(2);
    });
  });
});
