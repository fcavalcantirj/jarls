import { checkLastStanding, checkWinConditions, GameState, Piece } from '../index';

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

describe('checkLastStanding', () => {
  describe('returns winner ID when only one Jarl remains', () => {
    it('should return player 1 as winner when only their Jarl remains', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });

    it('should return player 2 as winner when only their Jarl remains', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
    });

    it('should detect victory with only Jarl remaining (no warriors)', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });
  });

  describe('returns null if multiple Jarls exist', () => {
    it('should return no victory when both Jarls exist', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory when both Jarls exist with Warriors', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });
  });

  describe('triggers immediately on last elimination', () => {
    it('should return victory immediately after eliminating opponent Jarl', () => {
      // Simulate state after opponent's Jarl was just eliminated
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        // p2's Jarl was just pushed off the edge, so only p1's pieces remain
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });
  });

  describe('handles multi-player scenarios', () => {
    it('should return no victory when 2 Jarls remain in 3-player game', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        // p3's Jarl was eliminated
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
        ],
      };

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return victory when 1 Jarl remains in 3-player game', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        // p1 and p3's Jarls were eliminated
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
        ],
      };

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
    });
  });

  describe('handles edge cases', () => {
    it('should return no victory when no Jarls exist (edge case)', () => {
      const pieces: Piece[] = [
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should return no victory with empty pieces array', () => {
      const state = createTestState([]);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
    });

    it('should not count shields as Jarls', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'shield-1', type: 'shield', playerId: null, position: { q: 0, r: 1 } },
        { id: 'shield-2', type: 'shield', playerId: null, position: { q: 0, r: -1 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });

    it('should not count warriors as Jarls', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: -1, r: 0 } },
        { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 1 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      // Only p1's Jarl exists, so p1 wins
      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
    });
  });

  describe('result structure', () => {
    it('should return correct structure for victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(typeof result.isVictory).toBe('boolean');
      expect(typeof result.winnerId).toBe('string');
    });

    it('should return correct structure for no victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkLastStanding(state);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(typeof result.isVictory).toBe('boolean');
      expect(result.winnerId).toBeNull();
    });
  });
});

describe('checkWinConditions', () => {
  describe('checks throne victory first', () => {
    it('should return throne victory when Jarl voluntarily moves to throne', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.condition).toBe('throne');
    });

    it('should return player 2 throne victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 3, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 0, r: 0 } }, // On throne
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p2-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
      expect(result.condition).toBe('throne');
    });
  });

  describe('checks last standing second', () => {
    it('should return last standing victory when only one Jarl remains', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        // p2's Jarl was just eliminated
      ];
      const state = createTestState(pieces);

      // The moved piece is not on throne, so throne check fails
      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.condition).toBe('lastStanding');
    });

    it('should return player 2 last standing victory', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        // p1's Jarl was just eliminated
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p2-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
      expect(result.condition).toBe('lastStanding');
    });

    it('should return last standing even with involuntary move', () => {
      // If a push eliminated the opponent Jarl, last standing still triggers
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Involuntary move (pushed), but still checks last standing
      const result = checkWinConditions(state, 'p1-jarl', false);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.condition).toBe('lastStanding');
    });
  });

  describe('returns correct winner and condition', () => {
    it('should return no victory when both Jarls exist and no throne victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });

    it('should return no victory with involuntary throne entry', () => {
      // Pushed Jarl on throne doesn't count as victory (though compression prevents this)
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne but pushed
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', false); // involuntary

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });
  });

  describe('throne victory takes precedence over last standing', () => {
    it('should return throne victory when both conditions could trigger', () => {
      // Scenario: p1 moves Jarl to throne while also being the last Jarl
      // (opponent was already eliminated)
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } }, // On throne
        // p2's Jarl was eliminated earlier
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      // Throne takes precedence over last standing
      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p1');
      expect(result.condition).toBe('throne');
    });
  });

  describe('handles edge cases', () => {
    it('should return no victory when piece not found', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'nonexistent-piece', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });

    it('should return no victory when warrior moves (not Jarl)', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      // Warrior moves, not a Jarl - no throne victory possible
      const result = checkWinConditions(state, 'p1-w1', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });

    it('should return no victory with empty pieces array', () => {
      const state = createTestState([]);

      const result = checkWinConditions(state, 'nonexistent', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });
  });

  describe('multi-player scenarios', () => {
    it('should return no victory when 2 Jarls remain in 3-player game', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        // p3's Jarl was eliminated
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
        ],
      };

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });

    it('should return last standing victory when 1 Jarl remains in 3-player game', () => {
      const pieces: Piece[] = [
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
        // p1 and p3's Jarls were eliminated
      ];
      const state: GameState = {
        ...createTestState(pieces),
        players: [
          { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: true },
          { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
          { id: 'p3', name: 'Player 3', color: '#00ff00', isEliminated: true },
        ],
      };

      const result = checkWinConditions(state, 'p2-jarl', true);

      expect(result.isVictory).toBe(true);
      expect(result.winnerId).toBe('p2');
      expect(result.condition).toBe('lastStanding');
    });
  });

  describe('result structure', () => {
    it('should return correct structure for throne victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(result).toHaveProperty('condition');
      expect(typeof result.isVictory).toBe('boolean');
      expect(typeof result.winnerId).toBe('string');
      expect(result.condition).toBe('throne');
    });

    it('should return correct structure for last standing victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(result).toHaveProperty('condition');
      expect(typeof result.isVictory).toBe('boolean');
      expect(typeof result.winnerId).toBe('string');
      expect(result.condition).toBe('lastStanding');
    });

    it('should return correct structure for no victory', () => {
      const pieces: Piece[] = [
        { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: -2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = checkWinConditions(state, 'p1-jarl', true);

      expect(result).toHaveProperty('isVictory');
      expect(result).toHaveProperty('winnerId');
      expect(result).toHaveProperty('condition');
      expect(result.isVictory).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.condition).toBeNull();
    });
  });
});
