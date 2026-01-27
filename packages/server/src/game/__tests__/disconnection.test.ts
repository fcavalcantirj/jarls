import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createActor } from 'xstate';
import { gameMachine } from '../machine';
import type { GameMachineInput, GameMachineContext } from '../types';
import type { GameState } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';

function createTestInput(turnTimerMs: number | null = null): GameMachineInput {
  return {
    gameId: 'test-game-disconnect',
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

function createGameInPlaying(turnTimerMs: number | null = null) {
  const input = createTestInput(turnTimerMs);
  const actor = createActor(gameMachine, { input });
  actor.start();

  actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor.send({ type: 'START_GAME', playerId: 'p1' });

  return actor;
}

describe('Game Machine - Disconnection and Reconnection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('game pauses on disconnect', () => {
    it('transitions to paused when current turn player disconnects', () => {
      const actor = createGameInPlaying();

      const before = actor.getSnapshot();
      expect(before.value).toEqual({ playing: 'awaitingMove' });
      expect(before.context.currentPlayerId).toBe('p1');

      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });

      const after = actor.getSnapshot();
      expect(after.value).toBe('paused');
      expect(after.context.disconnectedPlayers.has('p1')).toBe(true);

      actor.stop();
    });

    it('does not pause when non-current player disconnects', () => {
      const actor = createGameInPlaying();

      expect(actor.getSnapshot().context.currentPlayerId).toBe('p1');

      // p2 disconnects, but it's p1's turn
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p2' });

      const after = actor.getSnapshot();
      expect(after.value).toEqual({ playing: 'awaitingMove' });
      expect(after.context.disconnectedPlayers.has('p2')).toBe(true);

      actor.stop();
    });

    it('marks player as disconnected even when game does not pause', () => {
      const actor = createGameInPlaying();

      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p2' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.disconnectedPlayers.has('p2')).toBe(true);
      expect(snapshot.context.disconnectedPlayers.size).toBe(1);

      actor.stop();
    });

    it('handles multiple players disconnecting while paused', () => {
      const actor = createGameInPlaying();

      // p1 (current player) disconnects - game pauses
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('paused');

      // p2 also disconnects while paused
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p2' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('paused');
      expect(snapshot.context.disconnectedPlayers.has('p1')).toBe(true);
      expect(snapshot.context.disconnectedPlayers.has('p2')).toBe(true);
      expect(snapshot.context.disconnectedPlayers.size).toBe(2);

      actor.stop();
    });
  });

  describe('game resumes on reconnect', () => {
    it('transitions back to awaitingMove when disconnected player reconnects', () => {
      const actor = createGameInPlaying();

      // Pause the game
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('paused');

      // Reconnect
      actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });

      const after = actor.getSnapshot();
      expect(after.value).toEqual({ playing: 'awaitingMove' });
      expect(after.context.disconnectedPlayers.has('p1')).toBe(false);
      expect(after.context.disconnectedPlayers.size).toBe(0);

      actor.stop();
    });

    it('preserves game state after disconnect and reconnect', () => {
      const actor = createGameInPlaying();

      const beforeDisconnect = actor.getSnapshot();
      const currentPlayer = beforeDisconnect.context.currentPlayerId;
      const turnNumber = beforeDisconnect.context.turnNumber;
      const pieceCount = beforeDisconnect.context.pieces.length;

      // Disconnect and reconnect
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });

      const afterReconnect = actor.getSnapshot();
      expect(afterReconnect.context.currentPlayerId).toBe(currentPlayer);
      expect(afterReconnect.context.turnNumber).toBe(turnNumber);
      expect(afterReconnect.context.pieces.length).toBe(pieceCount);

      actor.stop();
    });

    it('allows normal gameplay to continue after reconnection', () => {
      const actor = createGameInPlaying();

      // Disconnect and reconnect
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });

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

      actor.stop();
    });
  });

  describe('paused state timeout behavior', () => {
    it('remains paused after 2-minute disconnect timeout', () => {
      const actor = createGameInPlaying();

      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('paused');

      // Advance past the 2-minute timeout
      jest.advanceTimersByTime(120_000);

      // Game should still be paused
      const after = actor.getSnapshot();
      expect(after.value).toBe('paused');

      actor.stop();
    });

    it('can still reconnect after timeout has expired', () => {
      const actor = createGameInPlaying();

      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });

      // Wait past the timeout
      jest.advanceTimersByTime(300_000); // 5 minutes

      // Reconnect should still work
      actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });

      const after = actor.getSnapshot();
      expect(after.value).toEqual({ playing: 'awaitingMove' });
      expect(after.context.disconnectedPlayers.has('p1')).toBe(false);

      actor.stop();
    });
  });

  describe('turn timer interaction with disconnect', () => {
    it('turn timer does not fire while game is paused', () => {
      const actor = createGameInPlaying(5000); // 5 second turn timer

      const before = actor.getSnapshot();
      expect(before.context.currentPlayerId).toBe('p1');

      // Advance 3 seconds, then disconnect
      jest.advanceTimersByTime(3000);
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('paused');

      // Advance well past the original turn timer
      jest.advanceTimersByTime(10_000);

      // Game should still be paused, turn not skipped
      const whilePaused = actor.getSnapshot();
      expect(whilePaused.value).toBe('paused');
      expect(whilePaused.context.currentPlayerId).toBe('p1');
      expect(whilePaused.context.turnNumber).toBe(0);

      actor.stop();
    });

    it('turn timer restarts after reconnection', () => {
      const actor = createGameInPlaying(5000);

      // Disconnect p1
      actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
      jest.advanceTimersByTime(10_000); // Wait while paused

      // Reconnect
      actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });
      expect(actor.getSnapshot().value).toEqual({ playing: 'awaitingMove' });
      expect(actor.getSnapshot().context.currentPlayerId).toBe('p1');

      // The turn timer should restart from the awaitingMove entry
      // Advance just under 5 seconds - should still be p1's turn
      jest.advanceTimersByTime(4999);
      expect(actor.getSnapshot().context.currentPlayerId).toBe('p1');

      // Advance to 5 seconds - should skip
      jest.advanceTimersByTime(1);
      expect(actor.getSnapshot().context.currentPlayerId).toBe('p2');

      actor.stop();
    });
  });
});
