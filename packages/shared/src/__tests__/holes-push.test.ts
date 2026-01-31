import {
  detectChain,
  resolvePush,
  applyMove,
  GameState,
  Piece,
  AxialCoord,
  HexDirection,
} from '../index';

function createTestState(
  pieces: Piece[],
  holes: AxialCoord[] = [],
  currentPlayerId: string = 'p1'
): GameState {
  return {
    id: 'test-game',
    phase: 'playing',
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players: [
      { id: 'p1', name: 'Player 1', color: '#FF0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000FF', isEliminated: false },
    ],
    pieces,
    holes,
    currentPlayerId,
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  };
}

describe('Push into holes', () => {
  describe('detectChain with holes', () => {
    it('returns hole terminator when chain ends at a hole', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      // Hole at q:2, r:0 - piece will be pushed into it
      const holes: AxialCoord[] = [{ q: 2, r: 0 }];
      const state = createTestState(pieces, holes);

      // Push East from q:1
      const result = detectChain(state, { q: 1, r: 0 }, 0 as HexDirection);

      expect(result.terminator).toBe('hole');
      expect(result.terminatorPosition).toEqual({ q: 2, r: 0 });
      expect(result.pieces).toHaveLength(1);
    });

    it('returns hole terminator for chain of multiple pieces', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      // Hole at q:3, r:0 - chain ends at hole
      const holes: AxialCoord[] = [{ q: 3, r: 0 }];
      const state = createTestState(pieces, holes);

      const result = detectChain(state, { q: 1, r: 0 }, 0 as HexDirection);

      expect(result.terminator).toBe('hole');
      expect(result.terminatorPosition).toEqual({ q: 3, r: 0 });
      expect(result.pieces).toHaveLength(2);
    });
  });

  describe('resolvePush with holes', () => {
    it('eliminates piece pushed into a hole', () => {
      const pieces: Piece[] = [
        { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'defender', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const holes: AxialCoord[] = [{ q: 2, r: 0 }];
      const state = createTestState(pieces, holes);

      const chain = detectChain(state, { q: 1, r: 0 }, 0 as HexDirection);
      expect(chain.terminator).toBe('hole');

      const result = resolvePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        0 as HexDirection,
        false,
        chain
      );

      // Defender should be eliminated
      expect(result.eliminatedPieceIds).toContain('defender');

      // Defender should be removed from pieces
      const defender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(defender).toBeUndefined();

      // Should have ELIMINATED event with cause 'hole'
      const eliminatedEvent = result.events.find((e) => e.type === 'ELIMINATED');
      expect(eliminatedEvent).toBeDefined();
      if (eliminatedEvent?.type === 'ELIMINATED') {
        expect(eliminatedEvent.cause).toBe('hole');
        expect(eliminatedEvent.pieceId).toBe('defender');
      }
    });

    it('eliminates last piece in chain when pushed into hole', () => {
      const pieces: Piece[] = [
        { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
      ];
      // Hole at q:3 - last piece (w2) gets pushed into it
      const holes: AxialCoord[] = [{ q: 3, r: 0 }];
      const state = createTestState(pieces, holes);

      const chain = detectChain(state, { q: 1, r: 0 }, 0 as HexDirection);
      const result = resolvePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        0 as HexDirection,
        false,
        chain
      );

      // Only w2 (last in chain) should be eliminated
      expect(result.eliminatedPieceIds).toHaveLength(1);
      expect(result.eliminatedPieceIds).toContain('w2');

      // w1 should survive and move to q:2
      const w1 = result.newState.pieces.find((p) => p.id === 'w1');
      expect(w1).toBeDefined();
      expect(w1?.position).toEqual({ q: 2, r: 0 });
    });
  });

  describe('Jarl pushed into hole', () => {
    it('eliminates player when their Jarl is pushed into a hole', () => {
      // Test using resolvePush directly since player elimination
      // happens only when the Jarl piece is removed
      const pieces: Piece[] = [
        { id: 'jarl1', type: 'jarl', playerId: 'p1', position: { q: -3, r: 0 } },
        { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'jarl2', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      // Hole at q:2, r:0 - Jarl will be pushed East into it
      const holes: AxialCoord[] = [{ q: 2, r: 0 }];
      const state = createTestState(pieces, holes);

      // Use resolvePush directly to test the push mechanics
      // The actual player elimination would happen in applyMove
      const chain = detectChain(state, { q: 1, r: 0 }, 0 as HexDirection);
      expect(chain.terminator).toBe('hole');

      const result = resolvePush(
        state,
        'attacker',
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        0 as HexDirection,
        true // has momentum
      );

      // Jarl should be in eliminated list
      expect(result.eliminatedPieceIds).toContain('jarl2');

      // Jarl should be removed from pieces
      const jarl = result.newState.pieces.find((p) => p.id === 'jarl2');
      expect(jarl).toBeUndefined();
    });
  });

  describe('applyMove with hole push', () => {
    it('applies move that pushes piece into hole', () => {
      const pieces: Piece[] = [
        // Attacker 2 hexes away for momentum bonus
        { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
        { id: 'defender', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const holes: AxialCoord[] = [{ q: 2, r: 0 }];
      const state = createTestState(pieces, holes);

      const result = applyMove(state, 'p1', {
        pieceId: 'attacker',
        destination: { q: 1, r: 0 }, // 2-hex move for momentum
      });

      expect(result.success).toBe(true);

      // Defender eliminated
      const defender = result.newState.pieces.find((p) => p.id === 'defender');
      expect(defender).toBeUndefined();

      // Attacker moved to defender's position
      const attacker = result.newState.pieces.find((p) => p.id === 'attacker');
      expect(attacker?.position).toEqual({ q: 1, r: 0 });

      // Has ELIMINATED event
      const elimEvent = result.events.find((e) => e.type === 'ELIMINATED');
      expect(elimEvent).toBeDefined();
    });
  });
});

describe('Hole vs Edge elimination', () => {
  it('hole elimination has cause "hole"', () => {
    const pieces: Piece[] = [
      // Attacker 2 hexes away for momentum bonus
      { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
      { id: 'defender', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
    ];
    const holes: AxialCoord[] = [{ q: 2, r: 0 }];
    const state = createTestState(pieces, holes);

    const result = applyMove(state, 'p1', {
      pieceId: 'attacker',
      destination: { q: 1, r: 0 }, // 2-hex move for momentum
    });

    const elimEvent = result.events.find((e) => e.type === 'ELIMINATED');
    expect(elimEvent).toBeDefined();
    if (elimEvent?.type === 'ELIMINATED') {
      expect(elimEvent.cause).toBe('hole');
    }
  });

  it('edge elimination still has cause "edge"', () => {
    // Piece 2 hexes away for momentum, pushed off edge
    const pieces: Piece[] = [
      { id: 'attacker', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
      { id: 'defender', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } },
    ];
    const state = createTestState(pieces, []);

    const result = applyMove(state, 'p1', {
      pieceId: 'attacker',
      destination: { q: 3, r: 0 }, // 2-hex move for momentum
    });

    const elimEvent = result.events.find((e) => e.type === 'ELIMINATED');
    expect(elimEvent).toBeDefined();
    if (elimEvent?.type === 'ELIMINATED') {
      expect(elimEvent.cause).toBe('edge');
    }
  });
});
