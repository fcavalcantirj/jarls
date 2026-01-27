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
      shieldCount: 5,
      warriorCount: 5,
      turnTimerMs: null,
    },
    ...overrides,
  };
}

function createTestActor(input?: GameMachineInput) {
  const actor = createActor(gameMachine, { input: input ?? createTestInput() });
  actor.start();
  return actor;
}

describe('Game Machine - Lobby State', () => {
  describe('initial state', () => {
    it('starts in the lobby state', () => {
      const actor = createTestActor();
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe('lobby');
      expect(snapshot.context.players).toEqual([]);
      expect(snapshot.context.phase).toBe('lobby');

      actor.stop();
    });

    it('initializes context from input', () => {
      const input = createTestInput({ gameId: 'custom-id' });
      const actor = createTestActor(input);
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.id).toBe('custom-id');
      expect(snapshot.context.config.playerCount).toBe(2);
      expect(snapshot.context.turnTimerMs).toBeNull();
      expect(snapshot.context.pieces).toEqual([]);
      expect(snapshot.context.turnNumber).toBe(0);

      actor.stop();
    });
  });

  describe('PLAYER_JOINED event', () => {
    it('adds a player to the lobby', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(1);
      expect(snapshot.context.players[0]).toEqual({
        id: 'p1',
        name: 'Alice',
        color: '#e63946',
        isEliminated: false,
        roundsSinceLastWarrior: null,
      });

      actor.stop();
    });

    it('assigns different colors to first and second player', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(2);
      expect(snapshot.context.players[0].color).toBe('#e63946');
      expect(snapshot.context.players[1].color).toBe('#457b9d');

      actor.stop();
    });

    it('does not add a player when lobby is full', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p3', playerName: 'Charlie' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(2);
      expect(snapshot.context.players.find((p) => p.id === 'p3')).toBeUndefined();

      actor.stop();
    });

    it('stays in lobby state after player joins', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      expect(actor.getSnapshot().value).toBe('lobby');

      actor.stop();
    });
  });

  describe('PLAYER_LEFT event', () => {
    it('removes a player from the lobby', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'PLAYER_LEFT', playerId: 'p1' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(1);
      expect(snapshot.context.players[0].id).toBe('p2');

      actor.stop();
    });

    it('does nothing if player not in lobby', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_LEFT', playerId: 'nonexistent' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(1);

      actor.stop();
    });

    it('stays in lobby state after player leaves', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_LEFT', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('lobby');

      actor.stop();
    });
  });

  describe('START_GAME event', () => {
    it('cannot start with fewer than 2 players', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'START_GAME', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('lobby');

      actor.stop();
    });

    it('cannot start with 0 players', () => {
      const actor = createTestActor();

      actor.send({ type: 'START_GAME', playerId: 'p1' });
      expect(actor.getSnapshot().value).toBe('lobby');

      actor.stop();
    });

    it('transitions through setup to playing with 2 players', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'START_GAME', playerId: 'p1' });
      // Setup state has an 'always' transition that immediately moves to 'playing.awaitingMove'
      expect(actor.getSnapshot().value).toEqual({ playing: 'awaitingMove' });

      actor.stop();
    });

    it('preserves players when transitioning to setup', () => {
      const actor = createTestActor();

      actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
      actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
      actor.send({ type: 'START_GAME', playerId: 'p1' });
      const snapshot = actor.getSnapshot();

      expect(snapshot.context.players).toHaveLength(2);
      expect(snapshot.context.players[0].name).toBe('Alice');
      expect(snapshot.context.players[1].name).toBe('Bob');

      actor.stop();
    });
  });
});
