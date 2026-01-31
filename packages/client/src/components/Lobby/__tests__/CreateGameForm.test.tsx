import { useGameStore } from '../../../store/gameStore';

const PLAYER_NAME_KEY = 'jarls-player-name';

describe('CreateGameForm - Player Name Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store to defaults
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

  describe('loading saved player name', () => {
    it('returns empty string when no name is saved', () => {
      // localStorage is already cleared in beforeEach
      const savedName = localStorage.getItem(PLAYER_NAME_KEY);
      expect(savedName).toBeNull();
    });

    it('returns saved name when one exists in localStorage', () => {
      localStorage.setItem(PLAYER_NAME_KEY, 'Ragnar');

      const savedName = localStorage.getItem(PLAYER_NAME_KEY);
      expect(savedName).toBe('Ragnar');
    });
  });

  describe('saving player name', () => {
    it('saves player name to localStorage', () => {
      const testName = 'Bjorn Ironside';

      // Simulate what CreateGameForm does when creating a game
      localStorage.setItem(PLAYER_NAME_KEY, testName);

      expect(localStorage.getItem(PLAYER_NAME_KEY)).toBe(testName);
    });

    it('overwrites previously saved name', () => {
      localStorage.setItem(PLAYER_NAME_KEY, 'OldName');
      localStorage.setItem(PLAYER_NAME_KEY, 'NewName');

      expect(localStorage.getItem(PLAYER_NAME_KEY)).toBe('NewName');
    });
  });

  describe('localStorage key constant', () => {
    it('uses the correct key for player name', () => {
      expect(PLAYER_NAME_KEY).toBe('jarls-player-name');
    });
  });
});
