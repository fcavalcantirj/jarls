import { useGameStore, selectIsMyTurn, selectMyPieces, selectCurrentPlayer } from '../gameStore';
import type { GameState, ValidMove } from '@jarls/shared';

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    id: 'game-1',
    phase: 'playing',
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        color: '#e63946',
        isEliminated: false,
      },
      {
        id: 'p2',
        name: 'Player 2',
        color: '#457b9d',
        isEliminated: false,
      },
    ],
    pieces: [
      { id: 'piece-1', type: 'jarl', playerId: 'p1', position: { q: 0, r: -3 } },
      { id: 'piece-2', type: 'warrior', playerId: 'p1', position: { q: 1, r: -3 } },
      { id: 'piece-3', type: 'jarl', playerId: 'p2', position: { q: 0, r: 3 } },
      { id: 'piece-4', type: 'warrior', playerId: 'p2', position: { q: -1, r: 3 } },
    ],
    holes: [],
    currentPlayerId: 'p1',
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
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
      movePending: false,
      isAnimating: false,
      pendingTurnUpdate: null,
      turnUpdateQueue: [],
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

  describe('movePending', () => {
    it('blocks double-move: movePending prevents piece selection between emit and broadcast', () => {
      // Simulate: player's turn, they send a move
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p1' }));
      useGameStore.getState().setPlayer('p1');
      expect(selectIsMyTurn(useGameStore.getState())).toBe(true);

      // Player sends move → movePending = true
      useGameStore.getState().setMovePending(true);

      // Even though gameState still says currentPlayerId = p1, isMyTurn must be false
      expect(selectIsMyTurn(useGameStore.getState())).toBe(false);

      // Server broadcasts turnPlayed with events → setPendingTurnUpdate clears movePending
      const newState = createMockGameState({ currentPlayerId: 'p2', turnNumber: 2 });
      useGameStore.getState().setPendingTurnUpdate({
        newState,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-1',
            from: { q: 0, r: -3 },
            to: { q: 0, r: -2 },
            hasMomentum: false,
          },
        ],
      });

      const state = useGameStore.getState();
      // movePending cleared by setPendingTurnUpdate
      expect(state.movePending).toBe(false);
      // isAnimating set immediately by setPendingTurnUpdate (closes animation gap)
      // This blocks handleInteraction() even though selectIsMyTurn might return true
      // because gameState.currentPlayerId hasn't changed yet (queued for animation)
      expect(state.isAnimating).toBe(true);
    });

    it('movePending is cleared on failed move callback', () => {
      useGameStore.getState().setMovePending(true);
      expect(useGameStore.getState().movePending).toBe(true);

      // Server rejects the move → client clears movePending
      useGameStore.getState().setMovePending(false);
      expect(useGameStore.getState().movePending).toBe(false);
    });
  });

  describe('setPendingTurnUpdate', () => {
    it('immediately sets isAnimating to prevent interaction gap', () => {
      expect(useGameStore.getState().isAnimating).toBe(false);

      const newState = createMockGameState({ currentPlayerId: 'p2' });
      useGameStore.getState().setPendingTurnUpdate({
        newState,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-1',
            from: { q: 0, r: -3 },
            to: { q: 0, r: -2 },
            hasMomentum: false,
          },
        ],
      });

      expect(useGameStore.getState().isAnimating).toBe(true);
    });

    it('queues multiple turn updates when they arrive during animation', () => {
      // Turn 5 arrives
      const turn5State = createMockGameState({ turnNumber: 5, currentPlayerId: 'p1' });
      useGameStore.getState().setPendingTurnUpdate({
        newState: turn5State,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-1',
            from: { q: 0, r: 0 },
            to: { q: 1, r: 0 },
            hasMomentum: false,
          },
        ],
      });

      // Turn 6 arrives while turn 5 animation would be playing
      const turn6State = createMockGameState({ turnNumber: 6, currentPlayerId: 'p2' });
      useGameStore.getState().queueTurnUpdate({
        newState: turn6State,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-2',
            from: { q: 1, r: 0 },
            to: { q: 2, r: 0 },
            hasMomentum: false,
          },
        ],
      });

      // Turn 7 arrives while turn 5 animation would still be playing
      const turn7State = createMockGameState({ turnNumber: 7, currentPlayerId: 'p1' });
      useGameStore.getState().queueTurnUpdate({
        newState: turn7State,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-3',
            from: { q: 2, r: 0 },
            to: { q: 3, r: 0 },
            hasMomentum: false,
          },
        ],
      });

      // Should have 2 queued updates (turn 6 and 7) in addition to the current pending
      expect(useGameStore.getState().turnUpdateQueue.length).toBe(2);

      // First pending update is turn 5
      expect(useGameStore.getState().pendingTurnUpdate?.newState.turnNumber).toBe(5);

      // Queue should have turns 6 and 7 in order
      expect(useGameStore.getState().turnUpdateQueue[0].newState.turnNumber).toBe(6);
      expect(useGameStore.getState().turnUpdateQueue[1].newState.turnNumber).toBe(7);
    });

    it('processes queued updates when animation completes', () => {
      // Turn 5 arrives
      const turn5State = createMockGameState({ turnNumber: 5, currentPlayerId: 'p1' });
      useGameStore.getState().setPendingTurnUpdate({
        newState: turn5State,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-1',
            from: { q: 0, r: 0 },
            to: { q: 1, r: 0 },
            hasMomentum: false,
          },
        ],
      });

      // Queue turn 6
      const turn6State = createMockGameState({ turnNumber: 6, currentPlayerId: 'p2' });
      useGameStore.getState().queueTurnUpdate({
        newState: turn6State,
        events: [
          {
            type: 'MOVE',
            pieceId: 'piece-2',
            from: { q: 1, r: 0 },
            to: { q: 2, r: 0 },
            hasMomentum: false,
          },
        ],
      });

      // Simulate animation completing and shifting to next queued update
      useGameStore.getState().shiftTurnUpdateQueue();

      // Now pendingTurnUpdate should be turn 6
      expect(useGameStore.getState().pendingTurnUpdate?.newState.turnNumber).toBe(6);
      expect(useGameStore.getState().turnUpdateQueue.length).toBe(0);
    });
  });

  describe('clearGame', () => {
    it('resets all state to defaults', () => {
      useGameStore.getState().setGameState(createMockGameState());
      useGameStore.getState().setPlayer('p1');
      useGameStore.getState().setSession('token-abc');
      useGameStore.getState().setConnectionStatus('connected');
      useGameStore.getState().selectPiece('piece-1', []);
      useGameStore.getState().setMovePending(true);

      useGameStore.getState().clearGame();
      const state = useGameStore.getState();
      expect(state.gameState).toBeNull();
      expect(state.playerId).toBeNull();
      expect(state.sessionToken).toBeNull();
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.selectedPieceId).toBeNull();
      expect(state.validMoves).toEqual([]);
      expect(state.movePending).toBe(false);
      expect(state.isAnimating).toBe(false);
    });

    it('clears ended game state so new game does not show old game over screen', () => {
      // Simulate an ended game
      useGameStore
        .getState()
        .setGameState(
          createMockGameState({ phase: 'ended', winnerId: 'p1', winCondition: 'throne' })
        );
      useGameStore.getState().setPlayer('p1');
      useGameStore.getState().setSession('old-token');

      // Simulate what CreateGameForm/GameList should do before navigating to new game
      useGameStore.getState().clearGame();
      useGameStore.getState().setSession('new-token');
      useGameStore.getState().setPlayer('p1-new');

      const state = useGameStore.getState();
      // Old game state must be gone
      expect(state.gameState).toBeNull();
      // New session must be set
      expect(state.sessionToken).toBe('new-token');
      expect(state.playerId).toBe('p1-new');
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
      movePending: false,
      isAnimating: false,
      pendingTurnUpdate: null,
      turnUpdateQueue: [],
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

    it('returns false when a move is pending even if currentPlayerId matches', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p1' }));
      useGameStore.getState().setPlayer('p1');
      expect(selectIsMyTurn(useGameStore.getState())).toBe(true);

      // Player sent a move, waiting for server response
      useGameStore.getState().setMovePending(true);
      expect(selectIsMyTurn(useGameStore.getState())).toBe(false);
    });

    it('returns true again after movePending is cleared', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'p1' }));
      useGameStore.getState().setPlayer('p1');
      useGameStore.getState().setMovePending(true);
      expect(selectIsMyTurn(useGameStore.getState())).toBe(false);

      useGameStore.getState().setMovePending(false);
      expect(selectIsMyTurn(useGameStore.getState())).toBe(true);
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
