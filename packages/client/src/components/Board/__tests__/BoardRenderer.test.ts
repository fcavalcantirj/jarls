import { describe, it, expect, jest } from '@jest/globals';
import { BoardRenderer } from '../BoardRenderer';
import type { GameState, Player } from '@jarls/shared';

// Create a minimal mock canvas context
function createMockContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 800, height: 600 },
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    arc: jest.fn(),
    fillText: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
  } as unknown as CanvasRenderingContext2D;
}

function createTestGameState(players: Player[]): GameState {
  return {
    id: 'test-game',
    phase: 'playing',
    config: {
      playerCount: players.length,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    players,
    pieces: [],
    holes: [],
    currentPlayerId: players[0]?.id ?? null,
    turnNumber: 0,
    roundNumber: 0,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
  };
}

describe('BoardRenderer', () => {
  describe('getPlayerColor', () => {
    it('returns player color from game state, not hardcoded palette', () => {
      const ctx = createMockContext();
      const renderer = new BoardRenderer(ctx);

      const players: Player[] = [
        { id: 'p1', name: 'Red', color: '#E53935', isEliminated: false },
        { id: 'p2', name: 'Blue', color: '#1E88E5', isEliminated: false },
        { id: 'p3', name: 'Green', color: '#43A047', isEliminated: false },
      ];

      const gameState = createTestGameState(players);

      // Render should populate player colors from game state
      renderer.render(gameState);

      // getPlayerColor should return the actual player colors
      expect(renderer.getPlayerColor('p1')).toBe('#E53935');
      expect(renderer.getPlayerColor('p2')).toBe('#1E88E5');
      expect(renderer.getPlayerColor('p3')).toBe('#43A047');
    });

    it('handles 4+ players with distinct colors', () => {
      const ctx = createMockContext();
      const renderer = new BoardRenderer(ctx);

      const players: Player[] = [
        { id: 'p1', name: 'Red', color: '#E53935', isEliminated: false },
        { id: 'p2', name: 'Blue', color: '#1E88E5', isEliminated: false },
        { id: 'p3', name: 'Green', color: '#43A047', isEliminated: false },
        { id: 'p4', name: 'Orange', color: '#FB8C00', isEliminated: false },
      ];

      const gameState = createTestGameState(players);
      renderer.render(gameState);

      // All 4 colors should be distinct and match game state
      const colors = players.map((p) => renderer.getPlayerColor(p.id));
      const uniqueColors = new Set(colors);

      expect(uniqueColors.size).toBe(4);
      expect(renderer.getPlayerColor('p4')).toBe('#FB8C00');
    });
  });
});
