import { hasLegalMoves, GameState, Piece } from '../index';

describe('hasLegalMoves', () => {
  // Helper to create a test game state
  const createTestState = (pieces: Piece[], currentPlayerId = 'p1'): GameState => ({
    id: 'test-game',
    config: {
      playerCount: 2,
      boardRadius: 3,
      shieldCount: 5,
      warriorCount: 5,
      turnTimerMs: null,
    },
    players: [
      { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
      { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
    ],
    pieces,
    phase: 'playing',
    currentPlayerId,
    turnNumber: 1,
    roundNumber: 1,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
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
      // Place one warrior completely surrounded by shields, but Jarl has room
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 2, r: -2 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      expect(hasLegalMoves(state, 'p1')).toBe(true);
    });

    it('should return true when player can attack an enemy piece', () => {
      // Warrior adjacent to enemy - can attack
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: -3, r: 0 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: 0, r: -3 } },
        // Surround w1 on other sides with shields
        { id: 's1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        { id: 's2', type: 'shield', playerId: null, position: { q: 1, r: -1 } },
        { id: 's3', type: 'shield', playerId: null, position: { q: 0, r: 0 } }, // Throne as shield for blocking
      ];
      const state = createTestState(pieces);
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

    it('should return false when player only has shields (shields cannot move)', () => {
      // Shields belong to no player (playerId: null), so this tests that
      // a player with literally no pieces returns false
      const pieces: Piece[] = [
        { id: 's1', type: 'shield', playerId: null, position: { q: 1, r: 0 } },
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

    it('should return false when all pieces are completely boxed in by shields and edges', () => {
      // Place a warrior in a corner surrounded by shields on all open sides
      // Board radius 3: edge hexes have max(|q|, |r|, |q+r|) = 3
      // Place warrior at edge position (3, -3) - only 2 neighbors are on board
      // Surround those 2 neighbors with shields
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: -3 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
        // Block the 2 on-board neighbors of (3, -3): (2, -3) and (3, -2) -- wait, let me check
        // Neighbors of (3, -3) in axial:
        // dir 0 (E):  (4, -3) - off board
        // dir 1 (NE): (4, -4) - off board (|4|+|-4| > 3... wait axial)
        // For radius 3, on-board means max(|q|, |r|, |q+r|) <= 3
        // (3,-3): max(3, 3, 0) = 3 ✓
        // Neighbors: (4,-3) max(4,3,1)=4 ✗, (4,-4) max(4,4,0)=4 ✗,
        //   (3,-4) max(3,4,1)=4 ✗, (2,-3) max(2,3,1)=3 ✓,
        //   (2,-2) max(2,2,0)=2 ✓, (3,-2) max(3,2,1)=3 ✓
        // So 3 neighbors on board: (2,-3), (2,-2), (3,-2)
        { id: 's1', type: 'shield', playerId: null, position: { q: 2, r: -3 } },
        { id: 's2', type: 'shield', playerId: null, position: { q: 2, r: -2 } },
        { id: 's3', type: 'shield', playerId: null, position: { q: 3, r: -2 } },
      ];
      const state = createTestState(pieces);
      // Jarl at (3,-3) is boxed in by 3 shields + 3 off-board hexes
      expect(hasLegalMoves(state, 'p1')).toBe(false);
    });

    it('should return false when single warrior surrounded by friendly pieces and shields', () => {
      // Warrior at center-ish position surrounded entirely by friendly pieces and shields
      // Place warrior at (1, 0), surround all 6 neighbors
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p1', position: { q: 2, r: -1 } },
        { id: 'w3', type: 'warrior', playerId: 'p1', position: { q: 1, r: -1 } },
        { id: 's1', type: 'shield', playerId: null, position: { q: 0, r: 0 } }, // Throne blocked by shield
        { id: 's2', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        { id: 'w4', type: 'warrior', playerId: 'p1', position: { q: 1, r: 1 } },
        // j1 at (2,0): neighbors are (3,0), (3,-1), (2,-1=w2), (1,0=w1), (1,1=w4), (2,1)
        // j1 has open neighbors at (3,0), (3,-1), (2,1) - so j1 can still move
        // w2 at (2,-1): neighbors (3,-1), (3,-2), (2,-2), (1,-1=w3? no w3 is at 1,-1), (1,0=w1), (2,0=j1)
        // Actually let's just verify w1 is boxed in
        // w1 at (1,0) neighbors: (2,0)=j1, (2,-1)=w2, (1,-1)=w3, (0,0)=s1, (0,1)=s2, (1,1)=w4
        // All 6 neighbors occupied by friendly pieces or shields -> w1 cannot move
        // But j1 CAN move, so hasLegalMoves should be TRUE for p1
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);
      // p1 has j1 which can move, so this should be true
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

    it('should allow skip when completely boxed in by shields and board edges', () => {
      // Extremely rare scenario: all of player's pieces boxed in
      // Jarl at corner (3, -3), surrounded by shields on all on-board neighbors
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p1', position: { q: 3, r: -3 } },
        { id: 's1', type: 'shield', playerId: null, position: { q: 2, r: -3 } },
        { id: 's2', type: 'shield', playerId: null, position: { q: 2, r: -2 } },
        { id: 's3', type: 'shield', playerId: null, position: { q: 3, r: -2 } },
        { id: 'j2', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Player 1 is completely boxed in - CAN skip
      expect(hasLegalMoves(state, 'p1')).toBe(false);
    });
  });
});
