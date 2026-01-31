import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { GameState, Piece } from '@jarls/shared';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Dynamic import after mock setup
let GroqAI: typeof import('../groq-ai.js').GroqAI;

beforeEach(async () => {
  jest.clearAllMocks();
  // Reset module cache to ensure fresh import
  jest.resetModules();
  ({ GroqAI } = await import('../groq-ai.js'));
});

function createTestState(): GameState {
  const pieces: Piece[] = [
    { id: 'p1-jarl', type: 'jarl', playerId: 'player1', position: { q: -2, r: 0 } },
    { id: 'p1-w1', type: 'warrior', playerId: 'player1', position: { q: -2, r: 1 } },
    { id: 'p2-jarl', type: 'jarl', playerId: 'player2', position: { q: 2, r: 0 } },
    { id: 'p2-w1', type: 'warrior', playerId: 'player2', position: { q: 2, r: -1 } },
    { id: 'shield1', type: 'shield', playerId: null, position: { q: 0, r: 0 } },
  ];

  return {
    id: 'test-game',
    phase: 'playing',
    config: {
      playerCount: 2,
      boardRadius: 3,
      shieldCount: 1,
      warriorCount: 4,
      turnTimerMs: null,
    },
    players: [
      { id: 'player1', name: 'Player 1', color: '#FF0000', isEliminated: false },
      { id: 'player2', name: 'Player 2', color: '#0000FF', isEliminated: false },
    ],
    pieces,
    currentPlayerId: 'player1',
    turnNumber: 1,
    roundNumber: 1,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  };
}

describe('GroqAI', () => {
  describe('constructor', () => {
    it('creates instance with default model and difficulty', () => {
      const ai = new GroqAI('test-api-key');
      expect(ai.difficulty).toBe('groq');
      expect(ai.model).toBe('llama-3.1-8b-instant');
      expect(ai.getConfig().difficulty).toBe('intermediate');
    });

    it('accepts custom model via config', () => {
      const ai = new GroqAI('test-api-key', { model: 'llama-3.3-70b-versatile' });
      expect(ai.model).toBe('llama-3.3-70b-versatile');
    });

    it('accepts custom difficulty', () => {
      const ai = new GroqAI('test-api-key', { difficulty: 'hard' });
      expect(ai.getConfig().difficulty).toBe('hard');
    });

    it('accepts custom prompt', () => {
      const customPrompt = 'You are a custom AI.';
      const ai = new GroqAI('test-api-key', { customPrompt });
      expect(ai.getConfig().customPrompt).toBe(customPrompt);
    });
  });

  describe('getConfig and updateConfig', () => {
    it('getConfig returns current configuration', () => {
      const ai = new GroqAI('test-api-key', {
        model: 'llama-3.3-70b-versatile',
        difficulty: 'hard',
      });
      const config = ai.getConfig();
      expect(config.type).toBe('groq');
      expect(config.model).toBe('llama-3.3-70b-versatile');
      expect(config.difficulty).toBe('hard');
    });

    it('updateConfig changes model mid-game', () => {
      const ai = new GroqAI('test-api-key');
      expect(ai.model).toBe('llama-3.1-8b-instant');

      ai.updateConfig({ model: 'llama-3.3-70b-versatile' });
      expect(ai.model).toBe('llama-3.3-70b-versatile');
    });

    it('updateConfig changes difficulty mid-game', () => {
      const ai = new GroqAI('test-api-key', { difficulty: 'beginner' });
      expect(ai.getConfig().difficulty).toBe('beginner');

      ai.updateConfig({ difficulty: 'hard' });
      expect(ai.getConfig().difficulty).toBe('hard');
    });

    it('updateConfig applies custom prompt', () => {
      const ai = new GroqAI('test-api-key');
      expect(ai.getConfig().customPrompt).toBeUndefined();

      ai.updateConfig({ customPrompt: 'Be aggressive!' });
      expect(ai.getConfig().customPrompt).toBe('Be aggressive!');
    });

    it('getConfig returns a copy (not reference)', () => {
      const ai = new GroqAI('test-api-key');
      const config1 = ai.getConfig();
      const config2 = ai.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('generateMove', () => {
    it('calls Groq API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      await ai.generateMove(state, 'player1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options?.method).toBe('POST');
      expect(options?.headers).toMatchObject({
        Authorization: 'Bearer test-api-key',
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(options?.body as string);
      expect(body.model).toBe('llama-3.1-8b-instant');
      expect(body.messages).toHaveLength(2); // system + user
      expect(body.temperature).toBe(0.3);
    });

    it('uses rules-based prompt (no pre-computed valid moves list)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      await ai.generateMove(state, 'player1');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const userMessage = body.messages.find((m: { role: string }) => m.role === 'user');

      // User prompt should contain game state but NOT a "Valid moves:" section
      expect(userMessage.content).toContain('Turn 1');
      expect(userMessage.content).toContain('p1-jarl');
      expect(userMessage.content).not.toContain('Valid moves:');
    });

    it('uses beginner prompt when difficulty=beginner', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key', { difficulty: 'beginner' });
      const state = createTestState();

      await ai.generateMove(state, 'player1');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');

      expect(systemMessage.content.toLowerCase()).toContain('beginner');
    });

    it('uses hard prompt when difficulty=hard', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key', { difficulty: 'hard' });
      const state = createTestState();

      await ai.generateMove(state, 'player1');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');

      expect(systemMessage.content.toLowerCase()).toContain('optimal');
    });

    it('uses custom prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const customPrompt = 'You are a Viking berserker! Be aggressive!';
      const ai = new GroqAI('test-api-key', { customPrompt });
      const state = createTestState();

      await ai.generateMove(state, 'player1');

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const systemMessage = body.messages.find((m: { role: string }) => m.role === 'system');

      expect(systemMessage.content).toBe(customPrompt);
    });

    it('returns valid move from API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      const move = await ai.generateMove(state, 'player1');

      expect(move).toEqual({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } });
    });

    it('handles rate limit (429) with retry', async () => {
      // First call returns 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '1' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
                },
              },
            ],
          }),
        } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      const move = await ai.generateMove(state, 'player1');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(move).toEqual({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } });
    }, 10000);

    it('falls back to random move after max retries on persistent rate limit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0.1' }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      ai.maxRetries = 2; // Reduce for faster test
      const state = createTestState();

      // Should return a valid random move, not throw
      const move = await ai.generateMove(state, 'player1');
      expect(move).toHaveProperty('pieceId');
      expect(move).toHaveProperty('destination');
      // Piece should belong to player1
      const piece = state.pieces.find((p) => p.id === move.pieceId);
      expect(piece?.playerId).toBe('player1');
    }, 10000);

    it('extracts JSON from markdown code blocks', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n{"pieceId": "p1-w1", "destination": {"q": -1, "r": 1}}\n```',
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      const move = await ai.generateMove(state, 'player1');

      expect(move).toEqual({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } });
    });

    it('falls back to random move on invalid API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'I think you should move the warrior somewhere nice!',
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      const move = await ai.generateMove(state, 'player1');

      // Should return a valid move (fallback to random)
      expect(move).toHaveProperty('pieceId');
      expect(move).toHaveProperty('destination');
      // Piece should belong to player1
      const piece = state.pieces.find((p) => p.id === move.pieceId);
      expect(piece?.playerId).toBe('player1');
    });

    it('validates response is legal move', async () => {
      // Return a move that would be illegal (invalid destination)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: 100, r: 100 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const state = createTestState();

      const move = await ai.generateMove(state, 'player1');

      // Should fall back to random valid move
      expect(move).toHaveProperty('pieceId');
      expect(move).toHaveProperty('destination');
      // Should NOT be the invalid destination
      expect(move.destination.q).not.toBe(100);
    });

    it('uses updated config after updateConfig is called', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1', destination: { q: -1, r: 1 } }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key', { difficulty: 'beginner' });
      const state = createTestState();

      // First move with beginner
      await ai.generateMove(state, 'player1');
      let body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.messages[0].content.toLowerCase()).toContain('beginner');

      // Update to hard difficulty
      ai.updateConfig({ difficulty: 'hard' });

      // Second move should use hard prompt
      mockFetch.mockClear();
      await ai.generateMove(state, 'player1');
      body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.messages[0].content.toLowerCase()).toContain('optimal');
    });
  });
});
