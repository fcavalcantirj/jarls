import { applyMove, GameState, Piece } from '../index';

/**
 * Tests for rotating first player each round.
 *
 * The first player in each round rotates:
 * 2-player game: P1,P2 -> P2,P1 -> P1,P2
 * 3-player game: P1,P2,P3 -> P2,P3,P1 -> P3,P1,P2
 */

function createTestState(
  pieces: Piece[],
  options: {
    currentPlayerId?: string;
    firstPlayerIndex?: number;
    roundNumber?: number;
    turnNumber?: number;
    players?: GameState['players'];
  } = {}
): GameState {
  return {
    id: 'test-game',
    phase: 'playing',
    config: {
      playerCount: options.players?.length ?? 2,
      boardRadius: 3,
      shieldCount: 0,
      warriorCount: 5,
      turnTimerMs: null,
    },
    players: options.players ?? [
      { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
    ],
    pieces,
    currentPlayerId: options.currentPlayerId ?? 'p1',
    turnNumber: options.turnNumber ?? 0,
    roundNumber: options.roundNumber ?? 0,
    firstPlayerIndex: options.firstPlayerIndex ?? 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
  };
}

describe('Rotating first player', () => {
  describe('2-player rotation: P1,P2 -> P2,P1 -> P1,P2', () => {
    const pieces: Piece[] = [
      { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
      { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
      { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 1 } },
      { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
      { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -2, r: -1 } },
    ];

    it('should start with firstPlayerIndex 0', () => {
      const state = createTestState(pieces);
      expect(state.firstPlayerIndex).toBe(0);
      expect(state.currentPlayerId).toBe('p1');
    });

    it('should not change firstPlayerIndex mid-round (after P1 moves)', () => {
      const state = createTestState(pieces);

      // P1 moves warrior (turn 0 of round 0)
      const result1 = applyMove(state, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 1, r: 0 },
      });

      expect(result1.success).toBe(true);
      expect(result1.newState.currentPlayerId).toBe('p2');
      expect(result1.newState.firstPlayerIndex).toBe(0);
      expect(result1.newState.roundNumber).toBe(0);
    });

    it('should rotate firstPlayerIndex to 1 after round 0 completes', () => {
      const state = createTestState(pieces);

      // P1 moves (turn 0)
      const result1 = applyMove(state, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 1, r: 0 },
      });

      // P2 moves (turn 1) - completes round 0
      const result2 = applyMove(result1.newState, 'p2', {
        pieceId: 'p2-w1',
        destination: { q: -1, r: 0 },
      });

      expect(result2.success).toBe(true);
      // Round completed, firstPlayerIndex rotates to 1 (P2 starts next round)
      expect(result2.newState.firstPlayerIndex).toBe(1);
      expect(result2.newState.roundNumber).toBe(1);
      // P2 starts round 1 (rotating first player)
      expect(result2.newState.currentPlayerId).toBe('p2');
    });

    it('should rotate firstPlayerIndex back to 0 after round 1 completes', () => {
      // Start at round 1 where P2 goes first (firstPlayerIndex = 1)
      const piecesR1: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];

      const state = createTestState(piecesR1, {
        currentPlayerId: 'p2',
        firstPlayerIndex: 1,
        roundNumber: 1,
        turnNumber: 2,
      });

      // P2 moves first in round 1
      const result1 = applyMove(state, 'p2', {
        pieceId: 'p2-w1',
        destination: { q: -1, r: 1 },
      });
      expect(result1.success).toBe(true);
      expect(result1.newState.currentPlayerId).toBe('p1');
      expect(result1.newState.firstPlayerIndex).toBe(1); // Not rotated yet

      // P1 moves - completes round 1
      const result2 = applyMove(result1.newState, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 1, r: 1 },
      });
      expect(result2.success).toBe(true);
      // After round 1 completes, firstPlayerIndex rotates back to 0 (P1)
      expect(result2.newState.firstPlayerIndex).toBe(0);
      expect(result2.newState.roundNumber).toBe(2);
      // P1 starts round 2
      expect(result2.newState.currentPlayerId).toBe('p1');
    });

    it('should cycle correctly over multiple rounds', () => {
      const piecesMulti: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 1 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -2, r: -1 } },
      ];

      let state = createTestState(piecesMulti);

      // ── Round 0: P1 goes first (firstPlayerIndex=0) ──
      expect(state.firstPlayerIndex).toBe(0);
      expect(state.currentPlayerId).toBe('p1');

      // P1 moves
      let result = applyMove(state, 'p1', {
        pieceId: 'p1-w2',
        destination: { q: 1, r: 1 },
      });
      state = result.newState;

      // P2 moves - end round 0
      result = applyMove(state, 'p2', {
        pieceId: 'p2-w2',
        destination: { q: -1, r: -1 },
      });
      state = result.newState;
      expect(state.roundNumber).toBe(1);
      expect(state.firstPlayerIndex).toBe(1);
      expect(state.currentPlayerId).toBe('p2'); // P2 starts round 1

      // ── Round 1: P2 goes first (firstPlayerIndex=1) ──
      // P2 moves
      result = applyMove(state, 'p2', {
        pieceId: 'p2-w1',
        destination: { q: -1, r: 0 },
      });
      state = result.newState;
      expect(state.currentPlayerId).toBe('p1');

      // P1 moves - end of round 1
      result = applyMove(state, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 1, r: 0 },
      });
      state = result.newState;
      expect(state.roundNumber).toBe(2);
      expect(state.firstPlayerIndex).toBe(0);
      expect(state.currentPlayerId).toBe('p1'); // P1 starts round 2 (back to index 0)
    });
  });

  describe('3-player rotation: P1,P2,P3 -> P2,P3,P1 -> P3,P1,P2', () => {
    const threePlayers: GameState['players'] = [
      { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: false },
    ];

    const pieces3p: Piece[] = [
      { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
      { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
      { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -2, r: 0 } },
      { id: 'p3-jarl', type: 'jarl', playerId: 'p3', position: { q: 0, r: -3 } },
      { id: 'p3-w1', type: 'warrior', playerId: 'p3', position: { q: 0, r: -2 } },
    ];

    it('should rotate through 3 players over 2 rounds', () => {
      let state = createTestState(pieces3p, {
        players: threePlayers,
        currentPlayerId: 'p1',
      });

      // ── Round 0: P1 first (firstPlayerIndex=0) ──
      expect(state.firstPlayerIndex).toBe(0);
      expect(state.currentPlayerId).toBe('p1');

      // P1 moves
      let result = applyMove(state, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 1, r: 0 },
      });
      state = result.newState;
      expect(state.currentPlayerId).toBe('p2');

      // P2 moves
      result = applyMove(state, 'p2', {
        pieceId: 'p2-w1',
        destination: { q: -1, r: 0 },
      });
      state = result.newState;
      expect(state.currentPlayerId).toBe('p3');

      // P3 moves - end of round 0
      result = applyMove(state, 'p3', {
        pieceId: 'p3-w1',
        destination: { q: 0, r: -1 },
      });
      state = result.newState;
      expect(state.roundNumber).toBe(1);
      expect(state.firstPlayerIndex).toBe(1);
      expect(state.currentPlayerId).toBe('p2'); // P2 starts round 1

      // ── Round 1: P2 first (firstPlayerIndex=1) ──
      // P2 moves
      result = applyMove(state, 'p2', {
        pieceId: 'p2-w1',
        destination: { q: -2, r: 0 },
      });
      state = result.newState;
      expect(state.currentPlayerId).toBe('p3');

      // P3 moves
      result = applyMove(state, 'p3', {
        pieceId: 'p3-w1',
        destination: { q: 0, r: -2 },
      });
      state = result.newState;
      expect(state.currentPlayerId).toBe('p1');

      // P1 moves - end of round 1
      result = applyMove(state, 'p1', {
        pieceId: 'p1-w1',
        destination: { q: 2, r: 0 },
      });
      state = result.newState;
      expect(state.roundNumber).toBe(2);
      expect(state.firstPlayerIndex).toBe(2);
      expect(state.currentPlayerId).toBe('p3'); // P3 starts round 2
    });
  });
});
