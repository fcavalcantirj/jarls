import { describe, it, expect } from '@jest/globals';
import { createActor, assign } from 'xstate';
import { gameMachine } from '../machine';
import type { GameMachineInput, GameMachineContext } from '../types';
import type { GameState, MoveCommand, Piece } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';

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

function createGameInPlaying(input?: GameMachineInput) {
  const actor = createActor(gameMachine, { input: input ?? createTestInput() });
  actor.start();

  // Join 2 players and start the game
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
  actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
  actor.send({ type: 'START_GAME', playerId: 'p1' });

  return actor;
}

/**
 * Extract GameState from GameMachineContext for use with shared functions.
 */
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
    roundsSinceElimination: context.roundsSinceElimination,
    winnerId: context.winnerId,
    winCondition: context.winCondition,
  };
}

/**
 * Find a valid move for the given player.
 * Returns the first available move command (pieceId + destination).
 */
function findValidMove(context: GameMachineContext, playerId: string): MoveCommand | null {
  const state = contextToGameState(context);
  const playerPieces = state.pieces.filter((p) => p.playerId === playerId);
  for (const piece of playerPieces) {
    const moves = getValidMoves(state, piece.id);
    if (moves.length > 0) {
      return { pieceId: piece.id, destination: moves[0].destination };
    }
  }
  return null;
}

/**
 * Create a game machine with a custom board where p1's Jarl is adjacent to the throne.
 * This allows testing victory by moving the Jarl onto the throne (0,0).
 */
function createGameWithJarlNearThrone() {
  // Override initializeBoard to place Jarl adjacent to throne
  const testMachine = gameMachine.provide({
    actions: {
      initializeBoard: assign(({ context }) => {
        // Place p1's Jarl at (0, -1), one hex away from throne (0, 0)
        // Place p2's Jarl far away, with warriors to keep the game valid
        const pieces: Piece[] = [
          { id: 'p1-jarl', type: 'jarl', playerId: 'p1', position: { q: 0, r: -1 } },
          { id: 'p1-w1', type: 'warrior', playerId: 'p1', position: { q: 1, r: -2 } },
          { id: 'p1-w2', type: 'warrior', playerId: 'p1', position: { q: -1, r: -1 } },
          { id: 'p2-jarl', type: 'jarl', playerId: 'p2', position: { q: 0, r: 3 } },
          { id: 'p2-w1', type: 'warrior', playerId: 'p2', position: { q: 1, r: 2 } },
          { id: 'p2-w2', type: 'warrior', playerId: 'p2', position: { q: -1, r: 3 } },
          { id: 'shield-1', type: 'shield', playerId: null, position: { q: 2, r: -2 } },
        ];

        return {
          ...context,
          pieces,
          phase: 'playing' as const,
          currentPlayerId: context.players[0].id,
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

describe('Game Machine - Playing State', () => {
  describe('playing state structure', () => {
    it('enters playing.awaitingMove after setup', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });

    it('has phase set to playing', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.phase).toBe('playing');

      actor.stop();
    });

    it('has currentPlayerId set to first player', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.currentPlayerId).toBe('p1');

      actor.stop();
    });

    it('has pieces on the board', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.pieces.length).toBeGreaterThan(0);

      actor.stop();
    });
  });

  describe('MAKE_MOVE handler', () => {
    it('valid move updates state and returns to awaitingMove', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      // Find a valid move for p1 (current player)
      const move = findValidMove(snapshot.context, 'p1');
      expect(move).not.toBeNull();

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: move!,
      });

      const afterMove = actor.getSnapshot();

      // Should still be in playing state (awaitingMove after checkingGameEnd passes through)
      expect(afterMove.value).toEqual({ playing: 'awaitingMove' });

      // Turn should have advanced (now p2's turn)
      expect(afterMove.context.currentPlayerId).toBe('p2');
      expect(afterMove.context.turnNumber).toBe(1);

      actor.stop();
    });

    it('invalid move (wrong player) is rejected - state unchanged', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      // p2 tries to move when it's p1's turn
      const move = findValidMove(snapshot.context, 'p2');

      if (move) {
        actor.send({
          type: 'MAKE_MOVE',
          playerId: 'p2',
          command: move,
        });

        const afterAttempt = actor.getSnapshot();

        // State should be unchanged
        expect(afterAttempt.value).toEqual({ playing: 'awaitingMove' });
        expect(afterAttempt.context.currentPlayerId).toBe('p1');
        expect(afterAttempt.context.turnNumber).toBe(0);
      }

      actor.stop();
    });

    it('invalid move (invalid destination) is rejected - state unchanged', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      const p1Pieces = snapshot.context.pieces.filter((p) => p.playerId === 'p1');
      expect(p1Pieces.length).toBeGreaterThan(0);

      // Try to move to an invalid off-board destination
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: p1Pieces[0].id,
          destination: { q: 99, r: 99 },
        },
      });

      const afterAttempt = actor.getSnapshot();

      // State should be unchanged
      expect(afterAttempt.value).toEqual({ playing: 'awaitingMove' });
      expect(afterAttempt.context.currentPlayerId).toBe('p1');
      expect(afterAttempt.context.turnNumber).toBe(0);

      actor.stop();
    });

    it('multiple valid moves alternate turns correctly', () => {
      const actor = createGameInPlaying();

      // p1 makes a move
      const snap1 = actor.getSnapshot();
      const move1 = findValidMove(snap1.context, 'p1');
      expect(move1).not.toBeNull();

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: move1!,
      });

      const snap2 = actor.getSnapshot();
      expect(snap2.context.currentPlayerId).toBe('p2');

      // p2 makes a move
      const move2 = findValidMove(snap2.context, 'p2');
      expect(move2).not.toBeNull();

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p2',
        command: move2!,
      });

      const snap3 = actor.getSnapshot();
      expect(snap3.context.currentPlayerId).toBe('p1');
      expect(snap3.context.turnNumber).toBe(2);

      actor.stop();
    });
  });

  describe('checkingGameEnd substate', () => {
    it('transitions back to awaitingMove when no winner', () => {
      const actor = createGameInPlaying();
      const snapshot = actor.getSnapshot();

      // Make a normal move - should cycle through checkingGameEnd and back
      const move = findValidMove(snapshot.context, 'p1');
      expect(move).not.toBeNull();

      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: move!,
      });

      const afterMove = actor.getSnapshot();

      // Should be back in awaitingMove (checkingGameEnd found no winner)
      expect(afterMove.value).toEqual({ playing: 'awaitingMove' });
      expect(afterMove.context.winnerId).toBeNull();

      actor.stop();
    });

    it('transitions to ended when Jarl moves to throne', () => {
      const actor = createGameWithJarlNearThrone();
      const snapshot = actor.getSnapshot();

      // Verify setup: p1's Jarl should be at (0, -1), throne is at (0, 0)
      expect(snapshot.value).toEqual({ playing: 'awaitingMove' });
      expect(snapshot.context.currentPlayerId).toBe('p1');

      const jarl = snapshot.context.pieces.find((p) => p.id === 'p1-jarl');
      expect(jarl).toBeDefined();
      expect(jarl!.position).toEqual({ q: 0, r: -1 });

      // Move Jarl to the throne (0, 0)
      actor.send({
        type: 'MAKE_MOVE',
        playerId: 'p1',
        command: {
          pieceId: 'p1-jarl',
          destination: { q: 0, r: 0 },
        },
      });

      const afterMove = actor.getSnapshot();

      // Machine should have transitioned to 'ended' via checkingGameEnd
      expect(afterMove.value).toBe('ended');
      expect(afterMove.context.winnerId).toBe('p1');
      expect(afterMove.context.winCondition).toBe('throne');
      expect(afterMove.context.phase).toBe('ended');
      expect(afterMove.status).toBe('done');

      actor.stop();
    });

    it('does not end game when non-winning move is made', () => {
      const actor = createGameWithJarlNearThrone();
      const snapshot = actor.getSnapshot();

      // Move a warrior instead of the Jarl to the throne
      // p1-w1 is at (1, -2), move it somewhere valid
      const state = contextToGameState(snapshot.context);
      const warriorMoves = getValidMoves(state, 'p1-w1');

      if (warriorMoves.length > 0) {
        actor.send({
          type: 'MAKE_MOVE',
          playerId: 'p1',
          command: {
            pieceId: 'p1-w1',
            destination: warriorMoves[0].destination,
          },
        });

        const afterMove = actor.getSnapshot();

        // Game should not have ended
        expect(afterMove.value).toEqual({ playing: 'awaitingMove' });
        expect(afterMove.context.winnerId).toBeNull();
      }

      actor.stop();
    });
  });
});
