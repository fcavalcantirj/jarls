import { useGameStore, selectIsMyTurn, selectCurrentPlayer } from '../../../store/gameStore';
import type { GameState } from '@jarls/shared';

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
        id: 'human',
        name: 'Human Player',
        color: '#e63946',
        isEliminated: false,
        roundsSinceLastWarrior: null,
        isAI: false,
      },
      {
        id: 'ai',
        name: 'Ingrid the Silent',
        color: '#457b9d',
        isEliminated: false,
        roundsSinceLastWarrior: null,
        isAI: true,
      },
    ],
    pieces: [],
    currentPlayerId: 'human',
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

describe('TurnIndicator state behavior', () => {
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

  describe('isAIThinking detection', () => {
    it('isAIThinking is false when human turn', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'human' }));
      useGameStore.getState().setPlayer('human');

      const state = useGameStore.getState();
      const currentPlayer = selectCurrentPlayer(state);
      const isMyTurn = selectIsMyTurn(state);
      const isAIThinking = currentPlayer?.isAI === true && !isMyTurn;

      expect(isAIThinking).toBe(false);
    });

    it('isAIThinking is true when AI turn', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'ai' }));
      useGameStore.getState().setPlayer('human');

      const state = useGameStore.getState();
      const currentPlayer = selectCurrentPlayer(state);
      const isMyTurn = selectIsMyTurn(state);
      const isAIThinking = currentPlayer?.isAI === true && !isMyTurn;

      expect(isAIThinking).toBe(true);
      expect(currentPlayer?.name).toBe('Ingrid the Silent');
    });

    it('isAIThinking is true during AI move animation', () => {
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'ai' }));
      useGameStore.getState().setPlayer('human');
      useGameStore.setState({ isAnimating: true });

      const state = useGameStore.getState();
      const currentPlayer = selectCurrentPlayer(state);
      const isMyTurn = selectIsMyTurn(state);
      const isAIThinking = currentPlayer?.isAI === true && !isMyTurn;

      expect(isAIThinking).toBe(true);
      expect(state.isAnimating).toBe(true);
    });

    it('considers pending turn update for AI momentum detection', () => {
      // Current state: AI's turn
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'ai' }));
      useGameStore.getState().setPlayer('human');
      useGameStore.setState({ isAnimating: true });
      // Pending state also shows AI (momentum)
      useGameStore.getState().setPendingTurnUpdate({
        newState: createMockGameState({ currentPlayerId: 'ai', turnNumber: 2 }),
        events: [],
      });

      const state = useGameStore.getState();
      const pendingPlayer =
        state.pendingTurnUpdate?.newState.players.find(
          (p) => p.id === state.pendingTurnUpdate?.newState.currentPlayerId
        ) ?? null;

      // Pending state shows AI will have another turn (momentum)
      expect(pendingPlayer?.isAI).toBe(true);
    });

    it('detects when AI turn ends and human turn begins', () => {
      // Current state: AI's turn
      useGameStore.getState().setGameState(createMockGameState({ currentPlayerId: 'ai' }));
      useGameStore.getState().setPlayer('human');
      useGameStore.setState({ isAnimating: true });
      // Pending state shows human's turn next
      useGameStore.getState().setPendingTurnUpdate({
        newState: createMockGameState({ currentPlayerId: 'human', turnNumber: 2 }),
        events: [],
      });

      const state = useGameStore.getState();
      const pendingPlayer =
        state.pendingTurnUpdate?.newState.players.find(
          (p) => p.id === state.pendingTurnUpdate?.newState.currentPlayerId
        ) ?? null;

      // Pending state shows human's turn after this animation
      expect(pendingPlayer?.isAI).toBe(false);
      expect(state.pendingTurnUpdate?.newState.currentPlayerId).toBe('human');
    });
  });
});
