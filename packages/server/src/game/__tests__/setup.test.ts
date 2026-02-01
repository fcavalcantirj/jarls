import { describe, it, expect } from '@jest/globals';
import { createActor } from 'xstate';
import { gameMachine } from '../machine';
import type { GameMachineInput } from '../types';

function createTestInput(overrides?: Partial<GameMachineInput>): GameMachineInput {
  return {
    gameId: 'test-game-1',
    config: {
      playerCount: 2,
      boardRadius: 3,
      warriorCount: 5,
      turnTimerMs: null,
      terrain: 'calm',
    },
    ...overrides,
  };
}

function createGameInSetup(input?: GameMachineInput) {
  const actor = createActor(gameMachine, { input: input ?? createTestInput() });
  actor.start();

  // Join 2 players and start
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor.send({ type: 'START_GAME', playerId: 'p1' });

  return actor;
}

describe('Game Machine - Setup State', () => {
  describe('board generation on entering setup', () => {
    it('generates pieces when entering setup state', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();

      // Should have pieces after setup
      expect(snapshot.context.pieces.length).toBeGreaterThan(0);

      actor.stop();
    });

    it('generates correct number of pieces for 2-player game', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();
      const { pieces } = snapshot.context;

      // 2 players: 2 jarls + 2*5 warriors = 12 pieces
      const jarls = pieces.filter((p) => p.type === 'jarl');
      const warriors = pieces.filter((p) => p.type === 'warrior');

      expect(jarls).toHaveLength(2);
      expect(warriors).toHaveLength(10);

      actor.stop();
    });

    it('assigns pieces to the correct lobby players', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();
      const { pieces, players } = snapshot.context;

      // Pieces should reference the lobby player IDs (p1, p2), not generated ones
      const playerPieces = pieces.filter((p) => p.playerId !== null);
      const playerIds = new Set(playerPieces.map((p) => p.playerId));

      expect(playerIds).toEqual(new Set(['p1', 'p2']));

      // Each player should have 1 jarl
      const p1Jarls = pieces.filter((p) => p.playerId === 'p1' && p.type === 'jarl');
      const p2Jarls = pieces.filter((p) => p.playerId === 'p2' && p.type === 'jarl');
      expect(p1Jarls).toHaveLength(1);
      expect(p2Jarls).toHaveLength(1);

      // Each player should have 5 warriors
      const p1Warriors = pieces.filter((p) => p.playerId === 'p1' && p.type === 'warrior');
      const p2Warriors = pieces.filter((p) => p.playerId === 'p2' && p.type === 'warrior');
      expect(p1Warriors).toHaveLength(5);
      expect(p2Warriors).toHaveLength(5);

      // Players should still be the original lobby players
      expect(players).toHaveLength(2);
      expect(players[0].id).toBe('p1');
      expect(players[1].id).toBe('p2');

      actor.stop();
    });
  });

  describe('transitions to playing automatically', () => {
    it('transitions from setup to playing immediately', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();

      // The always transition should move us to 'playing.awaitingMove'
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });

    it('sets phase to playing', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.phase).toBe('playing');

      actor.stop();
    });

    it('sets currentPlayerId to first player', () => {
      const actor = createGameInSetup();
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.currentPlayerId).toBe('p1');

      actor.stop();
    });
  });
});
