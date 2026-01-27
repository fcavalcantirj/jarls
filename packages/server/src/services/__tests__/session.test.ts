import { jest } from '@jest/globals';

const mockSet = jest.fn<(...args: unknown[]) => Promise<string | null>>();
const mockGet = jest.fn<(key: string) => Promise<string | null>>();

jest.unstable_mockModule('../../redis/client', () => ({
  redis: {
    set: mockSet,
    get: mockGet,
  },
}));

const { createSession, validateSession } = await import('../session');

describe('Session service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('generates a 64-character hex token', async () => {
      mockSet.mockResolvedValueOnce('OK');

      const token = await createSession('game-1', 'player-1', 'Thor');

      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores session data in Redis with 24h TTL', async () => {
      mockSet.mockResolvedValueOnce('OK');

      await createSession('game-1', 'player-1', 'Thor');

      expect(mockSet).toHaveBeenCalledTimes(1);
      const [key, value, exFlag, ttl] = mockSet.mock.calls[0];
      expect(key).toMatch(/^session:[0-9a-f]{64}$/);
      expect(JSON.parse(value as string)).toEqual({
        gameId: 'game-1',
        playerId: 'player-1',
        playerName: 'Thor',
      });
      expect(exFlag).toBe('EX');
      expect(ttl).toBe(86400);
    });

    it('generates unique tokens on each call', async () => {
      mockSet.mockResolvedValue('OK');

      const token1 = await createSession('game-1', 'player-1', 'Thor');
      const token2 = await createSession('game-1', 'player-1', 'Thor');

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateSession', () => {
    it('returns session data for a valid token', async () => {
      const sessionData = {
        gameId: 'game-1',
        playerId: 'player-1',
        playerName: 'Thor',
      };
      mockGet.mockResolvedValueOnce(JSON.stringify(sessionData));

      const result = await validateSession('abc123');

      expect(result).toEqual(sessionData);
      expect(mockGet).toHaveBeenCalledWith('session:abc123');
    });

    it('returns null for an invalid or expired token', async () => {
      mockGet.mockResolvedValueOnce(null);

      const result = await validateSession('nonexistent');

      expect(result).toBeNull();
    });
  });
});
