import { detectChain, GameState, Piece } from '../index';

describe('detectChain', () => {
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
        { id: 'p1', name: 'Player 1', color: '#ff0000', isEliminated: false },
        { id: 'p2', name: 'Player 2', color: '#0000ff', isEliminated: false },
      ],
      pieces,
      currentPlayerId: 'p1',
      turnNumber: 1,
      roundNumber: 1,
      roundsSinceElimination: 0,
      winnerId: null,
      winCondition: null,
    };
  }

  describe('returns array of pieces that will move', () => {
    it('should return single piece when only defender in chain', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0].id).toBe('defender');
    });

    it('should return multiple pieces when chain has multiple pieces', () => {
      const piece1: Piece = {
        id: 'piece1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const piece2: Piece = {
        id: 'piece2',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([piece1, piece2]);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].id).toBe('piece1');
      expect(result.pieces[1].id).toBe('piece2');
    });

    it('should return pieces in order from first pushed to last', () => {
      const piece1: Piece = {
        id: 'first',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const piece2: Piece = {
        id: 'second',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const piece3: Piece = {
        id: 'third',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([piece1, piece2, piece3]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces.map((p) => p.id)).toEqual(['first', 'second', 'third']);
    });

    it('should include Jarls in the chain', () => {
      const jarl: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const warrior: Piece = {
        id: 'warrior',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([jarl, warrior]);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].id).toBe('jarl');
      expect(result.pieces[1].id).toBe('warrior');
    });
  });

  describe('identifies chain terminator', () => {
    it('should identify empty hex terminator', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: 1, r: 0 });
    });

    it('should identify edge terminator when chain reaches board edge', () => {
      // Position piece at edge, push toward edge
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 3, r: 0 }, // East edge of radius 3 board
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: 3, r: 0 }, 0); // Push East (off board)

      expect(result.terminator).toBe('edge');
      expect(result.pieces).toHaveLength(1);
    });

    it('should identify shield terminator', () => {
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
      const state = createTestState([defender, shield]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.terminator).toBe('shield');
      expect(result.terminatorPosition).toEqual({ q: 1, r: 0 });
      expect(result.pieces).toHaveLength(1); // Only defender, shield not in chain
    });

    it('should identify throne terminator when pushing Warrior toward empty throne', () => {
      // Warrior adjacent to throne (center) - Warriors cannot enter the Throne
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -1, r: 0 }, // West of throne
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: -1, r: 0 }, 0); // Push East (toward throne)

      // Warriors cannot enter the Throne - it acts as a compression point
      expect(result.terminator).toBe('throne');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });
  });

  describe('handles mixed allegiance chains', () => {
    it('should include both friendly and enemy pieces in chain', () => {
      const friendly: Piece = {
        id: 'friendly',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const enemy: Piece = {
        id: 'enemy',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([friendly, enemy]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces.map((p) => p.playerId)).toEqual(['p1', 'p2']);
    });

    it('should handle alternating allegiance pieces', () => {
      const p1Warrior: Piece = {
        id: 'p1-1',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const p2Warrior: Piece = {
        id: 'p2-1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const p1Warrior2: Piece = {
        id: 'p1-2',
        type: 'warrior',
        playerId: 'p1',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([p1Warrior, p2Warrior, p1Warrior2]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(3);
      expect(result.pieces.map((p) => p.playerId)).toEqual(['p1', 'p2', 'p1']);
    });

    it('should include Jarls of different players in chain', () => {
      const p1Jarl: Piece = {
        id: 'p1-jarl',
        type: 'jarl',
        playerId: 'p1',
        position: { q: 0, r: 0 },
      };
      const p2Jarl: Piece = {
        id: 'p2-jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([p1Jarl, p2Jarl]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].type).toBe('jarl');
      expect(result.pieces[1].type).toBe('jarl');
      expect(result.pieces[0].playerId).toBe('p1');
      expect(result.pieces[1].playerId).toBe('p2');
    });
  });

  describe('different push directions', () => {
    it('should work with Northeast (direction 1) push', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const behind: Piece = {
        id: 'behind',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: -1 }, // Northeast of origin
      };
      const state = createTestState([defender, behind]);

      const result = detectChain(state, { q: 0, r: 0 }, 1); // Push Northeast

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].id).toBe('defender');
      expect(result.pieces[1].id).toBe('behind');
    });

    it('should work with West (direction 3) push', () => {
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 0, r: 0 },
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: 0, r: 0 }, 3); // Push West

      expect(result.pieces).toHaveLength(1);
      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: -1, r: 0 });
    });

    it('should work with Southwest (direction 4) push toward edge', () => {
      // Position piece at Southwest edge
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: -3, r: 3 }, // Southwest corner at radius 3
      };
      const state = createTestState([defender]);

      const result = detectChain(state, { q: -3, r: 3 }, 4); // Push Southwest

      expect(result.terminator).toBe('edge');
      expect(result.pieces).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle long chain to edge', () => {
      // Create chain from center to east edge
      const pieces: Piece[] = [];
      for (let q = 0; q <= 3; q++) {
        pieces.push({
          id: `warrior-${q}`,
          type: 'warrior',
          playerId: 'p2',
          position: { q, r: 0 },
        });
      }
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(4);
      expect(result.terminator).toBe('edge');
    });

    it('should handle chain ending at shield after several pieces', () => {
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 0, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'shield', type: 'shield', playerId: null, position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.terminator).toBe('shield');
      expect(result.terminatorPosition).toEqual({ q: 2, r: 0 });
    });

    it('should handle empty starting position (no defender)', () => {
      const state = createTestState([]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push from empty position

      expect(result.pieces).toHaveLength(0);
      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should handle shield immediately behind defender', () => {
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
      const state = createTestState([defender, shield]);

      const result = detectChain(state, { q: 0, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0].id).toBe('defender');
      expect(result.terminator).toBe('shield');
    });
  });

  describe('game scenarios', () => {
    it('should detect chain in typical combat scenario', () => {
      // Typical scenario: attacker pushes defender, defender has warrior behind
      const defender: Piece = {
        id: 'defender',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const behindDefender: Piece = {
        id: 'behind',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 2, r: 0 },
      };
      const state = createTestState([defender, behindDefender]);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: 3, r: 0 });
    });

    it('should detect chain pushing Jarl toward throne (Jarl can be pushed onto throne)', () => {
      // Jarl one hex from throne, pushed toward it
      // Jarls CAN be pushed onto the throne (it just doesn't count as a victory)
      const jarl: Piece = {
        id: 'jarl',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([jarl]);

      const result = detectChain(state, { q: 1, r: 0 }, 3); // Push West (toward throne)

      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0].type).toBe('jarl');
      // Throne is empty, so terminator is 'empty' - Jarls CAN be pushed onto the throne
      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should detect elimination chain at edge', () => {
      // Chain of 3 pieces at edge, first piece will be eliminated
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'w3', type: 'warrior', playerId: 'p2', position: { q: 3, r: 0 } }, // At edge
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(3);
      expect(result.terminator).toBe('edge');
    });
  });

  describe('push chain with friendly pieces (ally in chain)', () => {
    it('should include ally pieces in the push chain', () => {
      // Attacker p1 pushes p2 warrior, but p1 warrior is behind p2 warrior in push direction
      // Chain: p2 warrior at (1,0), p1 warrior at (2,0) — ally gets pushed too
      const pieces: Piece[] = [
        { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'ally', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[0].id).toBe('enemy');
      expect(result.pieces[1].id).toBe('ally');
      // Both pieces are in chain regardless of allegiance
      expect(result.pieces[0].playerId).toBe('p2');
      expect(result.pieces[1].playerId).toBe('p1');
      expect(result.terminator).toBe('empty');
    });

    it('should push ally toward edge if chain ends at edge', () => {
      // Chain toward edge: enemy at (1,0), ally at (2,0), ally at (3,0) — edge push
      const pieces: Piece[] = [
        { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'ally1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'ally2', type: 'warrior', playerId: 'p1', position: { q: 3, r: 0 } }, // At edge
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(3);
      expect(result.terminator).toBe('edge');
      // Ally at edge gets eliminated
      expect(result.pieces[2].id).toBe('ally2');
      expect(result.pieces[2].playerId).toBe('p1');
    });

    it('should compress allies against shield just like enemies', () => {
      // Shield at (3,0), ally at (2,0), enemy at (1,0) — shield compression
      const pieces: Piece[] = [
        { id: 'enemy', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
        { id: 'ally', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'shield', type: 'shield', playerId: null, position: { q: 3, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 1, r: 0 }, 0); // Push East

      expect(result.pieces).toHaveLength(2); // Shield not in chain
      expect(result.terminator).toBe('shield');
      // Both enemy and ally are in the compression chain
      expect(result.pieces[0].id).toBe('enemy');
      expect(result.pieces[1].id).toBe('ally');
    });
  });

  describe('Warrior Throne compression in detectChain', () => {
    it('should terminate with throne when Warrior is pushed toward empty throne', () => {
      // Single Warrior adjacent to throne, pushed toward it
      const warrior: Piece = {
        id: 'w1',
        type: 'warrior',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([warrior]);

      const result = detectChain(state, { q: 1, r: 0 }, 3); // Push West toward throne

      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0].id).toBe('w1');
      expect(result.terminator).toBe('throne');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should terminate with throne when chain of Warriors is pushed toward throne', () => {
      // Two Warriors in a line, pushed toward throne
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 2, r: 0 }, 3); // Push West toward throne

      expect(result.pieces).toHaveLength(2);
      expect(result.terminator).toBe('throne');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should NOT terminate with throne when Jarl is pushed toward empty throne', () => {
      // Jarl adjacent to throne — Jarls CAN be pushed onto the throne
      const jarl: Piece = {
        id: 'j1',
        type: 'jarl',
        playerId: 'p2',
        position: { q: 1, r: 0 },
      };
      const state = createTestState([jarl]);

      const result = detectChain(state, { q: 1, r: 0 }, 3); // Push West toward throne

      // Jarl can be pushed onto throne — no throne compression
      expect(result.terminator).toBe('empty');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should terminate with throne when chain ends with Warrior before throne', () => {
      // Jarl then Warrior in chain, Warrior is last and would be pushed onto throne
      const pieces: Piece[] = [
        { id: 'j1', type: 'jarl', playerId: 'p2', position: { q: 2, r: 0 } },
        { id: 'w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 2, r: 0 }, 3); // Push West toward throne

      // The last piece in the chain (w1) is a Warrior, so throne blocks
      expect(result.pieces).toHaveLength(2);
      expect(result.terminator).toBe('throne');
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });

    it('should NOT terminate with throne when chain ends with Jarl before throne', () => {
      // Warrior then Jarl in chain, Jarl is last and would be pushed onto throne
      const pieces: Piece[] = [
        { id: 'w1', type: 'warrior', playerId: 'p1', position: { q: 2, r: 0 } },
        { id: 'j1', type: 'jarl', playerId: 'p2', position: { q: 1, r: 0 } },
      ];
      const state = createTestState(pieces);

      const result = detectChain(state, { q: 2, r: 0 }, 3); // Push West toward throne

      // The last piece (j1) is a Jarl — throne doesn't block Jarls
      expect(result.pieces).toHaveLength(2);
      expect(result.terminator).toBe('empty');
      // Jarl can enter throne, so chain continues past to empty hex at (-1,0) or throne itself
      // Actually throne at (0,0) is empty, so Jarl moves there — terminator is empty at (0,0)
      expect(result.terminatorPosition).toEqual({ q: 0, r: 0 });
    });
  });
});
