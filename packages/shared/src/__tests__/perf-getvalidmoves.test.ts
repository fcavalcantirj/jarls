import { createInitialState, getValidMoves } from '../index';

function createPlayingState() {
  const state = createInitialState(['Alice', 'Bob']);
  return { ...state, phase: 'playing' as const };
}

describe('Performance: getValidMoves', () => {
  it('should compute valid moves for a single piece in under 10ms', () => {
    const state = createPlayingState();
    const playerId = state.players[0].id;
    const playerPieces = state.pieces.filter((p) => p.playerId === playerId);
    expect(playerPieces.length).toBeGreaterThan(0);

    const piece = playerPieces[0];

    // Warm up
    getValidMoves(state, piece.id);

    const start = Date.now();
    getValidMoves(state, piece.id);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('should compute valid moves for ALL pieces of a player in under 10ms', () => {
    const state = createPlayingState();
    const playerId = state.players[0].id;
    const playerPieces = state.pieces.filter((p) => p.playerId === playerId);
    expect(playerPieces.length).toBeGreaterThan(0);

    // Warm up
    for (const piece of playerPieces) {
      getValidMoves(state, piece.id);
    }

    const start = Date.now();
    for (const piece of playerPieces) {
      getValidMoves(state, piece.id);
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10);
  });

  it('should compute valid moves across multiple iterations consistently under 10ms avg', () => {
    const state = createPlayingState();
    const playerId = state.players[0].id;
    const playerPieces = state.pieces.filter((p) => p.playerId === playerId);
    const piece = playerPieces[0];

    // Warm up
    getValidMoves(state, piece.id);

    const iterations = 100;
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      getValidMoves(state, piece.id);
    }
    const totalElapsed = Date.now() - start;
    const avgElapsed = totalElapsed / iterations;

    expect(avgElapsed).toBeLessThan(10);
  });
});
