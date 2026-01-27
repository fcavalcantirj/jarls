import { useGameStore, selectIsMyTurn, selectMyPieces, selectCurrentPlayer } from '../gameStore';
import type { GameState, ValidMove } from '@jarls/shared';

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    id: 'game-1',
    phase: 'playing',
    config: {
      playerCount: 2,
      boardRadius: 3,
      shieldCount: 5,
      warriorCount: 5,
      turnTimerMs: null,
    },
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        color: '#e63946',
        isEliminated: false,
        roundsSinceLastWarrior: null,
      },
      {
        id: 'p2',
        name: 'Player 2',
        color: '#457b9d',
        isEliminated: false,
        roundsSinceLastWarrior: null,
      },
    ],
    pieces: [
      { id: 'piece-1', type: 'jarl', playerId: 'p1', position: { q: 0, r: -3 } },
      { id: 'piece-2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -3 } },
      { id: 'piece-3', type: 'jarl', playerId: 'p2', position: { q: 0, r: 3 } },
      { id: 'piece-4', type: 'warrior', playerId: 'p2', position: { q: -1, r: 3 } },
    ],
    currentPlayerId: 'p1',
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    ...overrides,
  };
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      playerId: null,
      sessionToken: null,
      connectionStatus: 'disconnected',
      selectedPieceId: null,
      validMoves: [],
    });
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useGameStore.getState();
      expect(state.gameState).toBeNull();
      expect(state.playerId).toBeNull();
      expect(state.sessionToken).toBeNull();
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.selectedPieceId).toBeNull();
      expect(state.validMoves).toEqual([]);
    });
  });

  describe('setGameState', () => {
    it('updates game state', () => {
      const gameState = createMockGameState();
      useGameStore.getState().setGameState(gameState);
      expect(useGameStore.getState().gameState).toBe(gameState);
    });
  });

  describe('setPlayer', () => {
    it('updates player id', () => {
      useGameStore.getState().setPlayer('p1');
      expect(useGameStore.getState().playerId).toBe('p1');
    });
  });

  describe('setSession', () => {
    it('updates session token', () => {
      useGameStore.getState().setSession('token-abc');
      expect(useGameStore.getState().sessionToken).toBe('token-abc');
    });
  });

  describe('setConnectionStatus', () => {
    it('updates connection status', () => {
      useGameStore.getState().setConnectionStatus('connected');
      expect(useGameStore.getState().connectionStatus).toBe('connected');
    });

    it('can set error status', () => {
      useGameStore.getState().setConnectionStatus('error');
      expect(useGameStore.getState().connectionStatus).toBe('error');
    });
  });

  describe('selectPiece', () => {
    it('sets selected piece and valid moves', () => {
      const moves: ValidMove[] = [
        { destination: { q: 1, r: -2 }, moveType: 'move', hasMomentum: false, combatPreview: null },
        {
          destination: { q: 0, r: -2 },
          moveType: 'attack',
          hasMomentum: true,
          combatPreview: null,
        },
      ];
      useGameStore.getState().selectPiece('piece-1', moves);
      const state = useGameStore.getState();
      expect(state.selectedPieceId).toBe('piece-1');
      expect(state.validMoves).toBe(moves);
    });
  });

  describe('clearSelection', () => {
    it('clears selected piece and valid moves', () => {
      const moves: ValidMove[] = [
        { destination: { q: 1, r: -2 }, moveType: 'move', hasMomentum: false, combatPreview: null },
      ];
      useGameStore.getState().selectPiece('piece-1', moves);
      useGameStore.getState().clearSelection();
      const state = useGameStore.getState();
      expect(state.selectedPieceId).toBeNull();
      expect(state.validMoves).toEqual([]);
    });
  });

  describe('clearGame', () => {
    it('resets all state to defaults', () => {
      useGameStore.getState().setGameState(createMockGameState());
      useGameStore.getState().setPlayer('p1');
      useGameStore.getState().setSession('token-abc');
      useGameStore.getState().setConnectionStatus('connected');
      useGameStore.getState().selectPiece('piece-1', []);

      useGameStore.getState().clearGame();
      const state = useGameStore.getState();
      expect(state.gameState).toBeNull();
      expect(state.playerId).toBeNull();
      expect(state.sessionToken).toBeNull();
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.selectedPieceId).toBeNull();
      expect(state.validMoves).toEqual([]);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameState: null,
      playerId: null,
      sessionToken: null,
      connectionStatus: 'disconnected',
      selectedPieceId: null,
      validMoves: [],
    });
  });

  describe('selectIsMyTurn', () => {
    it('returns false when no game state', () => {
      const state = useGameStore.getState();
      expect(selectIsMyTurn(state)).toBe(false);
    });

    it('returns false when no player id', () => {
      useGameStore.getState().setGameState(createMockGameState());
      expect(selectIsMyTurn(useGameStore.getState())).toBe(false);
    });

    it('returns true when it is the players turn', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p1' }));
      useGameStore.getState().setPlayer('p1');
      expect(selectIsMyTurn(useGameStore.getState())).toBe(true);
    });

    it('returns false when it is not the players turn', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p2' }));
      useGameStore.getState().setPlayer('p1');
      expect(selectIsMyTurn(useGameStore.getState())).toBe(false);
    });
  });

  describe('selectMyPieces', () => {
    it('returns empty array when no game state', () => {
      expect(selectMyPieces(useGameStore.getState())).toEqual([]);
    });

    it('returns empty array when no player id', () => {
      useGameStore.getState().setGameState(createMockGameState());
      expect(selectMyPieces(useGameStore.getState())).toEqual([]);
    });

    it('returns only pieces belonging to the player', () => {
      useGameStore.getState().setGameState(createMockGameState());
      useGameStore.getState().setPlayer('p1');
      const pieces = selectMyPieces(useGameStore.getState());
      expect(pieces).toHaveLength(2);
      expect(pieces.every((p) => p.playerId === 'p1')).toBe(true);
    });
  });

  describe('selectCurrentPlayer', () => {
    it('returns null when no game state', () => {
      expect(selectCurrentPlayer(useGameStore.getState())).toBeNull();
    });

    it('returns the current player', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p2' }));
      const player = selectCurrentPlayer(useGameStore.getState());
      expect(player).not.toBeNull();
      expect(player!.id).toBe('p2');
      expect(player!.name).toBe('Player 2');
    });

    it('returns null when currentPlayerId does not match any player', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'unknown' }));
      expect(selectCurrentPlayer(useGameStore.getState())).toBeNull();
    });
  });
});
