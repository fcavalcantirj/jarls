import { describe, it, expect } from '@jest/globals';
import {
  getSystemPromptForDifficulty,
  buildUserPrompt,
  GAME_RULES,
  BEGINNER_PROMPT,
  INTERMEDIATE_PROMPT,
  HARD_PROMPT,
} from '../prompts.js';
import type { GameState, Piece } from '@jarls/shared';

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

describe('AI Prompts', () => {
  describe('GAME_RULES', () => {
    it('includes victory conditions', () => {
      expect(GAME_RULES).toContain('throne');
      expect(GAME_RULES).toContain('Jarl');
      expect(GAME_RULES).toContain('Victory');
    });

    it('includes movement rules', () => {
      expect(GAME_RULES).toContain('Warrior');
      expect(GAME_RULES).toContain('hex');
    });

    it('includes combat mechanics', () => {
      expect(GAME_RULES).toContain('push');
      expect(GAME_RULES).toContain('attack');
      expect(GAME_RULES).toContain('defense');
    });
  });

  describe('BEGINNER_PROMPT', () => {
    it('includes basic rules', () => {
      expect(BEGINNER_PROMPT).toContain('beginner');
    });

    it('tells AI to miss threats sometimes', () => {
      expect(BEGINNER_PROMPT.toLowerCase()).toMatch(/miss|overlook|simple|safe/);
    });

    it('requests JSON response format', () => {
      expect(BEGINNER_PROMPT).toContain('JSON');
    });
  });

  describe('INTERMEDIATE_PROMPT', () => {
    it('includes full rules', () => {
      expect(INTERMEDIATE_PROMPT).toContain('Jarls');
    });

    it('mentions basic formations', () => {
      expect(INTERMEDIATE_PROMPT.toLowerCase()).toMatch(/formation|tactical|support/);
    });

    it('requests JSON response format', () => {
      expect(INTERMEDIATE_PROMPT).toContain('JSON');
    });
  });

  describe('HARD_PROMPT', () => {
    it('includes all formations with details', () => {
      expect(HARD_PROMPT.toLowerCase()).toContain('draft');
      expect(HARD_PROMPT.toLowerCase()).toContain('bracing');
    });

    it('includes strategic principles', () => {
      expect(HARD_PROMPT.toLowerCase()).toMatch(/optimal|strateg|control|exploit/);
    });

    it('requests JSON response format', () => {
      expect(HARD_PROMPT).toContain('JSON');
    });
  });

  describe('getSystemPromptForDifficulty', () => {
    it('returns beginner prompt for beginner difficulty', () => {
      const prompt = getSystemPromptForDifficulty('beginner');
      expect(prompt).toBe(BEGINNER_PROMPT);
    });

    it('returns intermediate prompt for intermediate difficulty', () => {
      const prompt = getSystemPromptForDifficulty('intermediate');
      expect(prompt).toBe(INTERMEDIATE_PROMPT);
    });

    it('returns hard prompt for hard difficulty', () => {
      const prompt = getSystemPromptForDifficulty('hard');
      expect(prompt).toBe(HARD_PROMPT);
    });

    it('uses custom prompt when provided', () => {
      const customPrompt = 'You are a custom AI with special instructions.';
      const prompt = getSystemPromptForDifficulty('hard', customPrompt);
      expect(prompt).toBe(customPrompt);
    });
  });

  describe('buildUserPrompt', () => {
    it('includes turn number', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      expect(prompt).toContain('Turn 1');
    });

    it('includes player pieces', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      expect(prompt).toContain('p1-jarl');
      expect(prompt).toContain('jarl');
      expect(prompt).toContain('-2');
    });

    it('includes enemy pieces', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      expect(prompt).toContain('p2-jarl');
      expect(prompt).toContain('Enemy');
    });

    it('includes throne position', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      expect(prompt).toContain('Throne');
      expect(prompt).toContain('(0,0)');
    });

    it('includes board radius', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      expect(prompt).toContain('3');
    });

    it('does NOT include pre-computed valid moves (rules-based approach)', () => {
      const state = createTestState();
      const prompt = buildUserPrompt(state, 'player1');
      // Should not contain a list of valid moves like "Valid moves:" section
      expect(prompt).not.toContain('Valid moves:');
    });

    it('includes recent moves section when history exists', () => {
      const state = createTestState();
      state.moveHistory = [
        {
          turnNumber: 1,
          playerId: 'player1',
          playerName: 'Player 1',
          pieceId: 'p1-w1',
          pieceType: 'warrior',
          from: { q: -2, r: 2 },
          to: { q: -1, r: 1 },
        },
        {
          turnNumber: 2,
          playerId: 'player2',
          playerName: 'Player 2',
          pieceId: 'p2-jarl',
          pieceType: 'jarl',
          from: { q: 2, r: 0 },
          to: { q: 1, r: 0 },
        },
      ];
      const prompt = buildUserPrompt(state, 'player1');

      expect(prompt).toContain('RECENT MOVES');
      expect(prompt).toContain('Turn 1: Player 1 moved warrior from (-2,2) to (-1,1)');
      expect(prompt).toContain('Turn 2: Player 2 moved jarl from (2,0) to (1,0)');
    });

    it('does not include recent moves section when history is empty', () => {
      const state = createTestState();
      state.moveHistory = [];
      const prompt = buildUserPrompt(state, 'player1');

      expect(prompt).not.toContain('RECENT MOVES');
    });

    it('includes captured piece in move history entry', () => {
      const state = createTestState();
      state.moveHistory = [
        {
          turnNumber: 3,
          playerId: 'player1',
          playerName: 'Player 1',
          pieceId: 'p1-w1',
          pieceType: 'warrior',
          from: { q: 0, r: 1 },
          to: { q: 1, r: 0 },
          captured: 'p2-w2',
        },
      ];
      const prompt = buildUserPrompt(state, 'player1');

      expect(prompt).toContain('CAPTURED p2-w2');
    });

    it('only shows last 6 moves in history', () => {
      const state = createTestState();
      state.moveHistory = [];
      // Create 10 moves
      for (let i = 1; i <= 10; i++) {
        state.moveHistory.push({
          turnNumber: i,
          playerId: i % 2 === 1 ? 'player1' : 'player2',
          playerName: i % 2 === 1 ? 'Player 1' : 'Player 2',
          pieceId: `piece-${i}`,
          pieceType: 'warrior',
          from: { q: i, r: 0 },
          to: { q: i - 1, r: 0 },
        });
      }
      const prompt = buildUserPrompt(state, 'player1');

      // Should contain turns 5-10 (last 6)
      expect(prompt).toContain('Turn 5:');
      expect(prompt).toContain('Turn 10:');
      // Should NOT contain turns 1-4
      expect(prompt).not.toContain('Turn 1:');
      expect(prompt).not.toContain('Turn 4:');
    });
  });
});
