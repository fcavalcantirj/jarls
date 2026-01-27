import { describe, it, expect } from '@jest/globals';
import { createActor, assign } from 'xstate';
import { gameMachine } from '../machine';
import type { GameMachineInput } from '../types';
import type { Piece } from '@jarls/shared';

function createTestInput(overrides?: Partial<GameMachineInput>): GameMachineInput {
  return {
    gameId: 'test-game-1',
    config: {
      playerCount: 2,
      boardRadius: 3,
      shieldCount: 5,
      warriorCount: 5,
      turnTimerMs: null,
    },
    ...overrides,
  };
}

/**
 * Create a game machine with custom board and roundsSinceElimination set
 * to trigger starvation when checkingGameEnd runs.
 */
function createGameWithStarvationTrigger(roundsSinceElimination: number) {
  const testMachine = gameMachine.provide({
    actions: {
      initializeBoard: assign(({ context }) => {
        // Place pieces for a valid 2-player game
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: -3, r: 0 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: -2, r: 0 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: -1, r: 0 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 3, r: 0 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 2, r: 0 } },
          { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: 1, r: 0 } },
          { id: 'shield-1', type: 'shield', playerId: null, position: { q: 0, r: -3 } },
        ];

        return {
          ...context,
          pieces,
          phase: 'playing' as const,
          currentPlayerId: context.players[0].id,
          roundsSinceElimination,
        };
      }),
    },
  });

  const actor = createActor(testMachine, { input: createTestInput() });
  actor.start();

  actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor.send({ type: 'START_GAME', playerId: 'p1' });

  return actor;
}

describe('Game Machine - Starvation State Structure', () => {
  describe('starvation trigger from checkingGameEnd', () => {
    it('transitions to starvation.awaitingChoices when starvation is triggered', () => {
      // roundsSinceElimination = 10 triggers starvation
      const actor = createGameWithStarvationTrigger(10);
      const snapshot = actor.getSnapshot();

      // Verify we're in playing state
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });
      expect(snapshot.context.roundsSinceElimination).toBe(10);

      // Make a valid move to go through checkingGameEnd
      // p1 warrior at (-1, 0) can move to (-1, -1) or (-1, 1)
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const afterMove = actor.getSnapshot();

      // Should be in starvation.awaitingChoices
      expect(afterMove.value).toEqual({ starvation: 'awaitingChoices' });

      actor.stop();
    });

    it('calculates starvation candidates on entering starvation state', () => {
      const actor = createGameWithStarvationTrigger(10);

      // Make a move to trigger starvation
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const snapshot = actor.getSnapshot();

      // Should have candidates populated
      expect(snapshot.context.starvationCandidates).toBeDefined();
      expect(snapshot.context.starvationCandidates.length).toBe(2); // 2 players

      // Each player should have candidates
      const p1Candidates = snapshot.context.starvationCandidates.find((c) => c.playerId === 'p1');
      const p2Candidates = snapshot.context.starvationCandidates.find((c) => c.playerId === 'p2');

      expect(p1Candidates).toBeDefined();
      expect(p2Candidates).toBeDefined();
      expect(p1Candidates!.candidates.length).toBeGreaterThan(0);
      expect(p2Candidates!.candidates.length).toBeGreaterThan(0);

      actor.stop();
    });

    it('clears starvation choices on entering starvation state', () => {
      const actor = createGameWithStarvationTrigger(10);

      // Make a move to trigger starvation
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.starvationChoices).toEqual([]);

      actor.stop();
    });

    it('does NOT transition to starvation when roundsSinceElimination < 10', () => {
      const actor = createGameWithStarvationTrigger(5);

      // Make a move - should go back to awaitingMove, not starvation
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const afterMove = actor.getSnapshot();

      // Should be back in awaitingMove (no starvation)
      expect(afterMove.value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });

    it('transitions to starvation at recurring interval (15 rounds)', () => {
      const actor = createGameWithStarvationTrigger(15);

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const afterMove = actor.getSnapshot();
      expect(afterMove.value).toEqual({ starvation: 'awaitingChoices' });

      actor.stop();
    });

    it('does NOT transition to starvation at non-trigger round (12)', () => {
      const actor = createGameWithStarvationTrigger(12);

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-w2',
          destination: { q: -1, r: -1 },
        },
      });

      const afterMove = actor.getSnapshot();
      expect(afterMove.value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });
  });
});
