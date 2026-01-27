import { jest } from '@jest/globals';

// Mock ioredis before importing client
const mockQuit = jest.fn<() => Promise<string>>();
const mockOn = jest.fn();

jest.unstable_mockModule('ioredis', () => ({
  default: jest.fn().mockImplementation(() => ({
    quit: mockQuit,
    on: mockOn,
  })),
}));

// Import after mocking - event handlers are registered at module load time
const { redis, closeRedis } = await import('../client');

// Capture event handler registrations from module initialization (before any beforeEach clears them)
const onCalls = [...mockOn.mock.calls] as [string, (...args: unknown[]) => void][];

describe('Redis client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('redis instance', () => {
    it('is defined', () => {
      expect(redis).toBeDefined();
    });

    it('registers error, connect, and reconnecting event handlers', () => {
      const eventNames = onCalls.map((call) => call[0]);
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('connect');
      expect(eventNames).toContain('reconnecting');
    });

    it('error handler logs to console.error', () => {
      const errorHandler = onCalls.find((call) => call[0] === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined;
      expect(errorHandler).toBeDefined();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      errorHandler!(new Error('Connection refused'));

      expect(consoleSpy).toHaveBeenCalledWith('Redis client error:', 'Connection refused');
      consoleSpy.mockRestore();
    });

    it('connect handler logs to console.log', () => {
      const connectHandler = onCalls.find((call) => call[0] === 'connect')?.[1] as
        | (() => void)
        | undefined;
      expect(connectHandler).toBeDefined();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      connectHandler!();

      expect(consoleSpy).toHaveBeenCalledWith('Redis client connected.');
      consoleSpy.mockRestore();
    });
  });

  describe('closeRedis()', () => {
    it('calls quit on the redis client', async () => {
      mockQuit.mockResolvedValueOnce('OK');

      await closeRedis();

      expect(mockQuit).toHaveBeenCalled();
    });
  });
});
