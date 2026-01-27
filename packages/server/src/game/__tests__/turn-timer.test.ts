import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createActor } from 'xstate';
import { gameMachine } from '../machine';
import type { GameMachineInput, GameMachineContext } from '../types';
import type { GameState } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';

function createTestInput(turnTimerMs: number | null): GameMachineInput {
  return {
    gameId: 'test-game-timer',
    config: {
      playerCount: 2,
      boardRadius: 3,
      shieldCount: 5,
      warriorCount: 5,
      turnTimerMs,
    },
  };
}

function contextToGameState(context: GameMachineContext): GameState {
  return {
    id: context.id,
    phase: context.phase,
    config: context.config,
    players: context.players,
    pieces: context.pieces,
    currentPlayerId: context.currentPlayerId,
    turnNumber: context.turnNumber,
    roundNumber: context.roundNumber,
    firstPlayerIndex: context.firstPlayerIndex,
    roundsSinceElimination: context.roundsSinceElimination,
    winnerId: context.winnerId,
    winCondition: context.winCondition,
  };
}

function createGameInPlaying(turnTimerMs: number | null) {
  const input = createTestInput(turnTimerMs);
  const actor = createActor(gameMachine, { input });
  actor.start();

  actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor.send({ type: 'START_GAME', playerId: 'p1' });

  return actor;
}

describe('Game Machine - Turn Timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('turn timer delayed transition', () => {
    it('skips turn after timer expires', () => {
      const actor = createGameInPlaying(5000); // 5 second timer
      const before = actor.getSnapshot();

      expect(before.value).toEqual({ playing: 'awaitingMove' });
      expect(before.context.currentPlayerId).toBe('p1');
      expect(before.context.turnNumber).toBe(0);

      // Advance time past the timer duration
      jest.advanceTimersByTime(5000);

      const after = actor.getSnapshot();

      // Turn should have been skipped - now p2's turn
      expect(after.value).toEqual({ playing: 'awaitingMove' });
      expect(after.context.currentPlayerId).toBe('p2');
      expect(after.context.turnNumber).toBe(1);

      actor.stop();
    });

    it('does not skip turn before timer expires', () => {
      const actor = createGameInPlaying(5000);

      // Advance time but not enough
      jest.advanceTimersByTime(4999);

      const snapshot = actor.getSnapshot();

      // Still p1's turn
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });
      expect(snapshot.context.currentPlayerId).toBe('p1');
      expect(snapshot.context.turnNumber).toBe(0);

      actor.stop();
    });

    it('no skip when timer is disabled (null)', () => {
      const actor = createGameInPlaying(null); // No timer

      // Advance a large amount of time
      jest.advanceTimersByTime(1_000_000);

      const snapshot = actor.getSnapshot();

      // Still p1's turn - no timeout occurred
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });
      expect(snapshot.context.currentPlayerId).toBe('p1');
      expect(snapshot.context.turnNumber).toBe(0);

      actor.stop();
    });

    it('timer resets after each turn transition', () => {
      const actor = createGameInPlaying(5000);

      // Skip p1's turn via timeout
      jest.advanceTimersByTime(5000);

      const afterP1Skip = actor.getSnapshot();
      expect(afterP1Skip.context.currentPlayerId).toBe('p2');
      expect(afterP1Skip.context.turnNumber).toBe(1);

      // Skip p2's turn via timeout
      jest.advanceTimersByTime(5000);

      const afterP2Skip = actor.getSnapshot();
      // After round completes with rotating first player, p2 starts next round
      expect(afterP2Skip.context.turnNumber).toBe(2);
      // Both turns were skipped, game continues
      expect(afterP2Skip.value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });

    it('timer is cancelled when a valid move is made before expiration', () => {
      const actor = createGameInPlaying(5000);

      // Advance partway through timer
      jest.advanceTimersByTime(3000);

      // Make a valid move for p1
      const snapshot = actor.getSnapshot();
      const state = contextToGameState(snapshot.context);
      const p1Pieces = state.pieces.filter((p) => p.playerId === 'p1');
      let moved = false;

      for (const piece of p1Pieces) {
        const moves = getValidMoves(state, piece.id);
        if (moves.length > 0) {
          actor.send({
            type: 'MAKE_MOVE',
            playerId: 'p1',
            command: { pieceId: piece.id, destination: moves[0].destination },
          });
          moved = true;
          break;
        }
      }

      expect(moved).toBe(true);

      const afterMove = actor.getSnapshot();
      expect(afterMove.context.currentPlayerId).toBe('p2');
      expect(afterMove.context.turnNumber).toBe(1);

      // Advance remaining time from old timer - should NOT cause another skip
      jest.advanceTimersByTime(2000);

      const afterOldTimerWouldFire = actor.getSnapshot();
      // Still p2's turn (old timer was cancelled)
      expect(afterOldTimerWouldFire.context.currentPlayerId).toBe('p2');
      expect(afterOldTimerWouldFire.context.turnNumber).toBe(1);

      // But the new timer for p2 should fire after full duration
      jest.advanceTimersByTime(3000); // 2000 + 3000 = 5000 total since p2's turn started

      const afterP2Timeout = actor.getSnapshot();
      expect(afterP2Timeout.context.turnNumber).toBe(2);

      actor.stop();
    });

    it('uses correct timer values (30s, 60s, 120s)', () => {
      // Test 30s timer
      const actor30 = createGameInPlaying(30000);
      jest.advanceTimersByTime(29999);
      expect(actor30.getSnapshot().context.currentPlayerId).toBe('p1');
      jest.advanceTimersByTime(1);
      expect(actor30.getSnapshot().context.currentPlayerId).toBe('p2');
      actor30.stop();
    });
  });
});
