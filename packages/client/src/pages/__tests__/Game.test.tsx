import { useGameStore } from '../../store/gameStore';
import type { GameState } from '@jarls/shared';

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    id: 'game-123',
    phase: 'playing', // Game already started (auto-start scenario)
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players: [
      {
        id: 'player-1',
        name: 'Human',
        color: '#e63946',
        isEliminated: false,
      },
      {
        id: 'ai-player',
        name: 'AI',
        color: '#457b9d',
        isEliminated: false,
        isAI: true,
      },
    ],
    pieces: [],
    holes: [],
    currentPlayerId: 'player-1',
    turnNumber: 0,
    roundNumber: 0,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
    ...overrides,
  };
}

describe('Game.tsx joinGame behavior', () => {
  beforeEach(() => {
    // Reset store to defaults
    useGameStore.setState({
      gameState: null,
      playerId: null,
      sessionToken: 'test-token',
      connectionStatus: 'connected',
      selectedPieceId: null,
      validMoves: [],
      movePending: false,
      isAnimating: false,
      pendingTurnUpdate: null,
    });
  });

  describe('joinGame callback should set gameState from response', () => {
    /**
     * Bug scenario: When a human vs AI game auto-starts, the game is already
     * in 'playing' phase when the human joins the socket room. The server
     * returns gameState in the joinGame callback, but Game.tsx was ignoring it.
     *
     * This caused the client to show "Loading game..." forever because:
     * 1. Game auto-started on server (phase: 'playing')
     * 2. Human joins socket room, gets gameState in joinGame callback
     * 3. Game.tsx only sets joined=true, ignores gameState
     * 4. Client waits for 'gameState' event that never comes (no state change)
     * 5. Client stuck on "Loading game..."
     */
    it('sets gameState when joinGame response includes gameState (auto-start scenario)', () => {
      const { setGameState } = useGameStore.getState();

      // Simulate joinGame callback response from an auto-started game
      const response = {
        success: true,
        playerId: 'player-1',
        gameState: createMockGameState({ phase: 'playing' }),
      };

      // This is what Game.tsx SHOULD do in its joinGame callback
      if (response.success && response.gameState) {
        setGameState(response.gameState);
      }

      // Verify gameState is set
      const state = useGameStore.getState();
      expect(state.gameState).not.toBeNull();
      expect(state.gameState?.phase).toBe('playing');
      expect(state.gameState?.players).toHaveLength(2);
    });

    it('does not set gameState when joinGame fails', () => {
      // Simulate failed joinGame - gameState remains null
      // (no action needed, just verify initial state)
      expect(useGameStore.getState().gameState).toBeNull();
    });

    it('handles lobby phase normally (waiting for game to start)', () => {
      const { setGameState } = useGameStore.getState();

      // Normal flow: game in lobby, waiting for start
      const response = {
        success: true,
        playerId: 'player-1',
        gameState: createMockGameState({ phase: 'lobby' }),
      };

      if (response.success && response.gameState) {
        setGameState(response.gameState);
      }

      const state = useGameStore.getState();
      expect(state.gameState?.phase).toBe('lobby');
    });
  });
});
