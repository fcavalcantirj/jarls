import {
  hexToKey,
  keyToHex,
  createInitialState,
  getPieceAt,
  getPieceById,
  getDirectionBetweenAdjacent,
  getLineDirection,
  AxialCoord,
} from '../index';

describe('getPieceAt', () => {
  it('should return piece when one exists at position', () => {
    const state = createInitialState(['A', 'B']);
    // Get any piece and verify getPieceAt finds it
    const piece = state.pieces[0];
    const found = getPieceAt(state, piece.position);
    expect(found).toBeDefined();
    expect(found?.id).toBe(piece.id);
  });

  it('should return undefined when no piece at position', () => {
    const state = createInitialState(['A', 'B']);
    // The throne is always empty at game start
    const throne: AxialCoord = { q: 0, r: 0 };
    const found = getPieceAt(state, throne);
    expect(found).toBeUndefined();
  });

  it('should find pieces at various positions', () => {
    const state = createInitialState(['A', 'B']);
    // Check every piece can be found by its position
    for (const piece of state.pieces) {
      const found = getPieceAt(state, piece.position);
      expect(found).toBeDefined();
      expect(found?.id).toBe(piece.id);
      expect(found?.type).toBe(piece.type);
    }
  });

  it('should return undefined for off-board positions', () => {
    const state = createInitialState(['A', 'B']);
    // Position far outside the board
    const offBoard: AxialCoord = { q: 100, r: 100 };
    const found = getPieceAt(state, offBoard);
    expect(found).toBeUndefined();
  });

  it('should find Jarl pieces correctly', () => {
    const state = createInitialState(['A', 'B']);
    const jarls = state.pieces.filter((p) => p.type === 'jarl');
    expect(jarls).toHaveLength(2);

    for (const jarl of jarls) {
      const found = getPieceAt(state, jarl.position);
      expect(found).toBeDefined();
      expect(found?.type).toBe('jarl');
      expect(found?.id).toBe(jarl.id);
    }
  });

  it('should find Warrior pieces correctly', () => {
    const state = createInitialState(['A', 'B']);
    const warriors = state.pieces.filter((p) => p.type === 'warrior');

    for (const warrior of warriors) {
      const found = getPieceAt(state, warrior.position);
      expect(found).toBeDefined();
      expect(found?.type).toBe('warrior');
      expect(found?.id).toBe(warrior.id);
    }
  });

  it('should find Shield pieces correctly', () => {
    const state = createInitialState(['A', 'B']);
    const shields = state.pieces.filter((p) => p.type === 'shield');

    for (const shield of shields) {
      const found = getPieceAt(state, shield.position);
      expect(found).toBeDefined();
      expect(found?.type).toBe('shield');
      expect(found?.id).toBe(shield.id);
      expect(found?.playerId).toBeNull(); // Shields have no owner
    }
  });

  it('should handle empty game state gracefully', () => {
    const state = createInitialState(['A', 'B']);
    // Create an empty pieces array
    const emptyState = { ...state, pieces: [] };
    const found = getPieceAt(emptyState, { q: 0, r: 0 });
    expect(found).toBeUndefined();
  });

  it('should return correct piece when multiple pieces exist', () => {
    const state = createInitialState(['A', 'B']);
    // Ensure each position has exactly the piece we expect
    const positionMap = new Map<string, string>();
    for (const piece of state.pieces) {
      positionMap.set(hexToKey(piece.position), piece.id);
    }

    for (const [posKey, expectedId] of positionMap) {
      const pos = keyToHex(posKey);
      if (pos) {
        const found = getPieceAt(state, pos);
        expect(found?.id).toBe(expectedId);
      }
    }
  });
});

describe('getPieceById', () => {
  it('should return piece when ID exists', () => {
    const state = createInitialState(['A', 'B']);
    const piece = state.pieces[0];
    const found = getPieceById(state, piece.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(piece.id);
    expect(found?.type).toBe(piece.type);
    expect(found?.position).toEqual(piece.position);
  });

  it('should return undefined when ID does not exist', () => {
    const state = createInitialState(['A', 'B']);
    const found = getPieceById(state, 'non-existent-id');
    expect(found).toBeUndefined();
  });

  it('should find all pieces by their IDs', () => {
    const state = createInitialState(['A', 'B']);
    for (const piece of state.pieces) {
      const found = getPieceById(state, piece.id);
      expect(found).toBeDefined();
      expect(found).toEqual(piece);
    }
  });

  it('should return undefined for empty string ID', () => {
    const state = createInitialState(['A', 'B']);
    const found = getPieceById(state, '');
    expect(found).toBeUndefined();
  });

  it('should find Jarl pieces by ID', () => {
    const state = createInitialState(['A', 'B']);
    const jarls = state.pieces.filter((p) => p.type === 'jarl');

    for (const jarl of jarls) {
      const found = getPieceById(state, jarl.id);
      expect(found).toBeDefined();
      expect(found?.type).toBe('jarl');
      expect(found?.playerId).not.toBeNull();
    }
  });

  it('should find Warrior pieces by ID', () => {
    const state = createInitialState(['A', 'B']);
    const warriors = state.pieces.filter((p) => p.type === 'warrior');

    for (const warrior of warriors) {
      const found = getPieceById(state, warrior.id);
      expect(found).toBeDefined();
      expect(found?.type).toBe('warrior');
      expect(found?.playerId).not.toBeNull();
    }
  });

  it('should find Shield pieces by ID', () => {
    const state = createInitialState(['A', 'B']);
    const shields = state.pieces.filter((p) => p.type === 'shield');

    for (const shield of shields) {
      const found = getPieceById(state, shield.id);
      expect(found).toBeDefined();
      expect(found?.type).toBe('shield');
      expect(found?.playerId).toBeNull();
    }
  });

  it('should handle empty pieces array gracefully', () => {
    const state = createInitialState(['A', 'B']);
    const emptyState = { ...state, pieces: [] };
    const found = getPieceById(emptyState, 'any-id');
    expect(found).toBeUndefined();
  });

  it('should return exact piece object (same reference)', () => {
    const state = createInitialState(['A', 'B']);
    const piece = state.pieces[0];
    const found = getPieceById(state, piece.id);
    expect(found).toBe(piece); // Same reference
  });

  it('should work with different player counts', () => {
    for (let count = 2; count <= 6; count++) {
      const names = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
      const state = createInitialState(names);

      // Verify all pieces can be found by ID
      for (const piece of state.pieces) {
        const found = getPieceById(state, piece.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(piece.id);
      }
    }
  });
});

describe('getDirectionBetweenAdjacent', () => {
  it('should return correct direction for adjacent hexes (East)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 1, r: 0 };
    expect(getDirectionBetweenAdjacent(from, to)).toBe(0);
  });

  it('should return correct direction for adjacent hexes (West)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: -1, r: 0 };
    expect(getDirectionBetweenAdjacent(from, to)).toBe(3);
  });

  it('should return correct direction for all 6 directions', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    // Direction 0 (East): q+1, r+0
    expect(getDirectionBetweenAdjacent(from, { q: 1, r: 0 })).toBe(0);
    // Direction 1 (Northeast): q+1, r-1
    expect(getDirectionBetweenAdjacent(from, { q: 1, r: -1 })).toBe(1);
    // Direction 2 (Northwest): q+0, r-1
    expect(getDirectionBetweenAdjacent(from, { q: 0, r: -1 })).toBe(2);
    // Direction 3 (West): q-1, r+0
    expect(getDirectionBetweenAdjacent(from, { q: -1, r: 0 })).toBe(3);
    // Direction 4 (Southwest): q-1, r+1
    expect(getDirectionBetweenAdjacent(from, { q: -1, r: 1 })).toBe(4);
    // Direction 5 (Southeast): q+0, r+1
    expect(getDirectionBetweenAdjacent(from, { q: 0, r: 1 })).toBe(5);
  });

  it('should return null for non-adjacent hexes', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 2, r: 0 }; // Distance 2
    expect(getDirectionBetweenAdjacent(from, to)).toBeNull();
  });

  it('should return null for same hex', () => {
    const from: AxialCoord = { q: 1, r: 2 };
    expect(getDirectionBetweenAdjacent(from, from)).toBeNull();
  });
});

describe('getLineDirection', () => {
  it('should return direction for hexes along q-axis (East)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 3, r: 0 };
    expect(getLineDirection(from, to)).toBe(0);
  });

  it('should return direction for hexes along q-axis (West)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: -3, r: 0 };
    expect(getLineDirection(from, to)).toBe(3);
  });

  it('should return direction for hexes along r-axis (Southeast)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 0, r: 3 };
    expect(getLineDirection(from, to)).toBe(5);
  });

  it('should return direction for hexes along r-axis (Northwest)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 0, r: -3 };
    expect(getLineDirection(from, to)).toBe(2);
  });

  it('should return direction for hexes along s-axis (Northeast)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 3, r: -3 };
    expect(getLineDirection(from, to)).toBe(1);
  });

  it('should return direction for hexes along s-axis (Southwest)', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: -3, r: 3 };
    expect(getLineDirection(from, to)).toBe(4);
  });

  it('should return null for non-straight-line positions', () => {
    const from: AxialCoord = { q: 0, r: 0 };
    const to: AxialCoord = { q: 2, r: 1 }; // Not on a straight line
    expect(getLineDirection(from, to)).toBeNull();
  });

  it('should return null for same position', () => {
    const from: AxialCoord = { q: 1, r: 2 };
    expect(getLineDirection(from, from)).toBeNull();
  });
});
