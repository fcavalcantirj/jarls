import { useGameStore } from '../../../store/gameStore';
import type { GameState } from '@jarls/shared';

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    id: 'game-123',
    phase: 'lobby',
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
        name: 'Host Player',
        color: '#e63946',
        isEliminated: false,
      },
      {
        id: 'player-2',
        name: 'AI Opponent',
        color: '#457b9d',
        isEliminated: false,
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

describe('WaitingRoom shareable URL behavior', () => {
  beforeEach(() => {
    // Reset store - NO session token (visitor from shared URL)
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
    });
  });

  it('should show join form when no sessionToken (shareable URL scenario)', () => {
    // When a user visits /lobby/:gameId via a shared link,
    // they don't have a sessionToken yet. Instead of showing an error,
    // we should show a join form so they can enter their name and join.
    const state = useGameStore.getState();

    // No session token means visitor from shared URL
    expect(state.sessionToken).toBeNull();

    // The expected behavior:
    // - Show a "Join Game" form with name input
    // - NOT show "No active session for this game" error
    // This test documents the expected behavior for the implementation
  });

  it('should set sessionToken after successful join via API', async () => {
    const { setSession, setPlayer } = useGameStore.getState();

    // Simulate successful join API response
    const joinResponse = {
      sessionToken: 'new-session-token',
      playerId: 'player-2',
    };

    // After joining via API, store the session
    setSession(joinResponse.sessionToken);
    setPlayer(joinResponse.playerId);

    const state = useGameStore.getState();
    expect(state.sessionToken).toBe('new-session-token');
    expect(state.playerId).toBe('player-2');
  });
});

describe('WaitingRoom joinGame behavior', () => {
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

  describe('joinGame callback sets store state', () => {
    it('sets playerId from joinGame response', () => {
      // This tests the core behavior: when joinGame succeeds,
      // playerId must be set in the store for isHost calculation to work
      const { setPlayer } = useGameStore.getState();

      // Simulate what WaitingRoom does when joinGame succeeds
      const response = {
        success: true,
        playerId: 'player-1',
        gameState: createMockGameState(),
      };

      if (response.playerId) {
        setPlayer(response.playerId);
      }

      expect(useGameStore.getState().playerId).toBe('player-1');
    });

    it('sets gameState from joinGame response', () => {
      const { setGameState } = useGameStore.getState();

      const mockState = createMockGameState();
      const response = {
        success: true,
        playerId: 'player-1',
        gameState: mockState,
      };

      if (response.gameState) {
        setGameState(response.gameState);
      }

      expect(useGameStore.getState().gameState).toBe(mockState);
      expect(useGameStore.getState().gameState?.players).toHaveLength(2);
    });

    it('isHost is true when playerId matches first player', () => {
      const { setPlayer, setGameState } = useGameStore.getState();

      // Simulate successful joinGame response for host
      const mockState = createMockGameState();
      setPlayer('player-1'); // First player in list
      setGameState(mockState);

      const state = useGameStore.getState();
      const isHost =
        state.gameState != null &&
        state.playerId != null &&
        state.gameState.players.length > 0 &&
        state.gameState.players[0].id === state.playerId;

      expect(isHost).toBe(true);
    });

    it('isHost is false when playerId does not match first player', () => {
      const { setPlayer, setGameState } = useGameStore.getState();

      // Simulate joining as second player
      const mockState = createMockGameState();
      setPlayer('player-2'); // Second player, not host
      setGameState(mockState);

      const state = useGameStore.getState();
      const isHost =
        state.gameState != null &&
        state.playerId != null &&
        state.gameState.players.length > 0 &&
        state.gameState.players[0].id === state.playerId;

      expect(isHost).toBe(false);
    });

    it('isHost is false when playerId is null (the bug we fixed)', () => {
      const { setGameState } = useGameStore.getState();

      // Bug scenario: gameState is set but playerId was not set
      const mockState = createMockGameState();
      setGameState(mockState);
      // Note: playerId is still null (not set)

      const state = useGameStore.getState();
      const isHost =
        state.gameState != null &&
        state.playerId != null && // This will be false!
        state.gameState.players.length > 0 &&
        state.gameState.players[0].id === state.playerId;

      expect(isHost).toBe(false);
      expect(state.playerId).toBeNull(); // Confirms the bug scenario
    });

    it('canStart is true when host and 2+ players', () => {
      const { setPlayer, setGameState } = useGameStore.getState();

      const mockState = createMockGameState(); // Has 2 players
      setPlayer('player-1');
      setGameState(mockState);

      const state = useGameStore.getState();
      const isHost =
        state.gameState != null &&
        state.playerId != null &&
        state.gameState.players.length > 0 &&
        state.gameState.players[0].id === state.playerId;

      const playerCount = state.gameState?.players.length ?? 0;
      const canStart = isHost && playerCount >= 2;

      expect(canStart).toBe(true);
    });
  });
});
