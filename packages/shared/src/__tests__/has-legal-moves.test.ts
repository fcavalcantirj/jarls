import { hasLegalMoves, GameState, Piece, AxialCoord } from '../index';

describe('hasLegalMoves', () => {
  // Helper to create a test game state
  const createTestState = (
    pieces: Piece[],
    currentPlayerId = 'p1',
    holes: AxialCoord[] = []
  ): GameState => ({
    id: 'test-game',
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players: [
      { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
    ],
    pieces,
    holes,
    phase: 'playing',
    currentPlayerId,
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  });

  describe('player with available moves', () => {
    it('should return true when player has a Warrior with open moves', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 0, r: -3 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });

    it('should return true when player has a Jarl with open moves', () => {
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 0, r: -3 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });

    it('should return true when at least one piece can move even if others cannot', () => {
      // Place one warrior, Jarl has room to move
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 2, r: -2 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });

    it('should return true when player can attack an enemy piece', () => {
      // Warrior adjacent to enemy - can attack
      // Even if surrounded by holes and pieces on other sides, attack is possible
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -3, r: 0 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 0, r: -3 } },
      ];
      // Add holes around w1 on other sides (except the enemy direction and throne)
      const holes: AxialCoord[] = [
        { q: 0, r: 1 },
        { q: 1, r: -1 },
        { q: 1, r: 1 },
      ];
      // Note: (0,0) is throne, not blocked by hole
      const state = createTestState(pieces, 'p1', holes);
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });
  });

  describe('player with no available moves', () => {
    it('should return false when player has no pieces', () => {
      const pieces: Piece[] = [
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 0, r: -3 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p1')).toBe(false);
    });

    it('should return false for non-existent player', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 0, r: 1 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p3')).toBe(false);
    });

    it('should return false when all pieces are completely boxed in by holes and edges', () => {
      // Place a Jarl in a corner surrounded by holes on all open sides
      // Board radius 3: edge hexes have max(|q|, |r|, |q+r|) = 3
      // Place Jarl at edge position (3, -3) - only 3 neighbors are on board
      // Surround those 3 neighbors with holes
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: -3 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      // Block the 3 on-board neighbors of (3, -3): (2, -3), (2, -2), (3, -2)
      const holes: AxialCoord[] = [
        { q: 2, r: -3 },
        { q: 2, r: -2 },
        { q: 3, r: -2 },
      ];
      const state = createTestState(pieces, 'p1', holes);
      // Jarl at (3,-3) is boxed in by 3 holes + 3 off-board hexes
      expect(hasLegalMoves(state, 'p1')).toBe(false);
    });

    it('should return false when single warrior surrounded by friendly pieces and holes', () => {
      // Warrior at (1, 0), surrounded on all sides by friendly pieces and holes
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: -1 } },
        { id: 'w3', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 'w4', type: 'warrior', playerId: 'p1', position: { q: 1, r: 1 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      // w1 at (1,0) neighbors: (2,0)=j1, (2,-1)=w2, (1,-1)=w3, (0,0)=throne, (0,1)=hole, (1,1)=w4
      const holes: AxialCoord[] = [{ q: 0, r: 1 }];
      const state = createTestState(pieces, 'p1', holes);
      // w1 is boxed in, but j1 CAN move to (3,0), (3,-1), (2,1)
      // So hasLegalMoves should be TRUE for p1
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });
  });

  describe('no-pass rule enforcement', () => {
    it('should confirm players with moves cannot skip (has legal moves)', () => {
      // Normal game state - player should have moves
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: -2 } },
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: -1 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 2 } },
        { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: -2, r: 1 } },
      ];
      const state = createTestState(pieces);

      // Player 1 has legal moves - cannot skip
      expect(hasLegalMoves(state, 'p1')).toBe(true);

      // Player 2 also has legal moves
      expect(hasLegalMoves(state, 'p2')).toBe(true);
    });

    it('should allow skip when completely boxed in by holes and board edges', () => {
      // Extremely rare scenario: all of player's pieces boxed in
      // Jarl at corner (3, -3), surrounded by holes on all on-board neighbors
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: -3 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const holes: AxialCoord[] = [
        { q: 2, r: -3 },
        { q: 2, r: -2 },
        { q: 3, r: -2 },
      ];
      const state = createTestState(pieces, 'p1', holes);

      // Player 1 is completely boxed in - CAN skip
      expect(hasLegalMoves(state, 'p1')).toBe(false);
    });
  });
});
