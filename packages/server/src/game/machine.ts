import { createMachine, assign } from 'xstate';
import type { GameMachineContext, GameMachineEvent, GameMachineInput } from './types';
import type { Player } from '@jarls/shared';

/**
 * Guard: Can the game start?
 * Requires at least 2 players in the lobby.
 */
function canStartGame({ context }: { context: GameMachineContext }): boolean {
  return context.players.length >= 2;
}

/**
 * Guard: Is the lobby full?
 * Maximum players determined by config.playerCount.
 */
function isLobbyFull({ context }: { context: GameMachineContext }): boolean {
  return context.players.length >= context.config.playerCount;
}

/**
 * XState v5 game machine for Jarls.
 *
 * Initial state: 'lobby'
 * - Players can join and leave
 * - Game starts when host triggers START_GAME with >= 2 players
 */
export const gameMachine = createMachine({
  id: 'game',
  type: 'compound' as const,
  initial: 'lobby',
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
    input: {} as GameMachineInput,
  },
  context: ({ input }: { input: GameMachineInput }): GameMachineContext => ({
    id: input.gameId,
    phase: 'lobby',
    config: input.config,
    players: [],
    pieces: [],
    currentPlayerId: null,
    turnNumber: 0,
    roundNumber: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    turnTimerMs: input.config.turnTimerMs ?? null,
    disconnectedPlayers: new Set<string>(),
    starvationChoices: [],
  }),
  states: {
    lobby: {
      on: {
        PLAYER_JOINED: {
          guard: ({ context }) => !isLobbyFull({ context }),
          actions: assign({
            players: ({ context, event }) => {
              const newPlayer: Player = {
                id: event.playerId,
                name: event.playerName,
                color: context.players.length === 0 ? '#e63946' : '#457b9d',
                isEliminated: false,
                roundsSinceLastWarrior: null,
              };
              return [...context.players, newPlayer];
            },
          }),
        },
        PLAYER_LEFT: {
          actions: assign({
            players: ({ context, event }) => context.players.filter((p) => p.id !== event.playerId),
          }),
        },
        START_GAME: {
          guard: canStartGame,
          target: 'setup',
        },
      },
    },
    setup: {},
    playing: {},
    starvation: {},
    paused: {},
    ended: {
      type: 'final' as const,
    },
  },
});
