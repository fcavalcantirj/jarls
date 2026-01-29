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
  };
}

describe('GroqAI', () => {
  describe('constructor', () => {
    it('creates instance with default model', () => {
      const ai = new GroqAI('test-api-key');
      expect(ai.difficulty).toBe('groq');
      expect(ai.model).toBe('llama-3.1-8b-instant');
    });

    it('accepts custom model', () => {
      const ai = new GroqAI('test-api-key', 'meta-llama/llama-4-scout-17b-16e-instruct');
      expect(ai.model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
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
  });

  describe('makeStarvationChoice', () => {
    it('returns a valid starvation choice', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ pieceId: 'p1-w1' }),
              },
            },
          ],
        }),
      } as Response);

      const ai = new GroqAI('test-api-key');
      const candidates = [
        {
          playerId: 'player1',
          candidates: [
            { id: 'p1-w1', type: 'warrior' as const, position: { q: -2, r: 1 } },
            { id: 'p1-w2', type: 'warrior' as const, position: { q: -1, r: 1 } },
          ],
        },
      ];

      const choice = await ai.makeStarvationChoice(candidates, 'player1');

      expect(choice).toEqual({ playerId: 'player1', pieceId: 'p1-w1' });
    });

    it('falls back to random choice on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const ai = new GroqAI('test-api-key');
      const candidates = [
        {
          playerId: 'player1',
          candidates: [
            { id: 'p1-w1', type: 'warrior' as const, position: { q: -2, r: 1 } },
            { id: 'p1-w2', type: 'warrior' as const, position: { q: -1, r: 1 } },
          ],
        },
      ];

      const choice = await ai.makeStarvationChoice(candidates, 'player1');

      expect(choice.playerId).toBe('player1');
      expect(['p1-w1', 'p1-w2']).toContain(choice.pieceId);
    });
  });
});
