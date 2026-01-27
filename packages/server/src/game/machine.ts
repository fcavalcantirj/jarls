import { setup, assign } from 'xstate';
import type { GameMachineContext, GameMachineEvent, GameMachineInput } from './types';
import type { Piece, Player } from '@jarls/shared';
import { createInitialState, applyMove } from '@jarls/shared';

/**
 * Get the next active (non-eliminated) player ID after the current player.
 */
function getNextActivePlayerId(context: GameMachineContext, currentPlayerId: string): string {
  const activePlayers = context.players.filter((p) => !p.isEliminated);
  const currentIndex = activePlayers.findIndex((p) => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % activePlayers.length;
  return activePlayers[nextIndex].id;
}

/**
 * Advance the turn without making a move (used for turn timer timeout).
 * Mirrors the turn advancement logic in applyMove from shared.
 */
function advanceTurnSkip(context: GameMachineContext): Partial<GameMachineContext> {
  const currentPlayerId = context.currentPlayerId!;
  const nextPlayerId = getNextActivePlayerId(context, currentPlayerId);
  const newTurnNumber = context.turnNumber + 1;

  const activePlayers = context.players.filter((p) => !p.isEliminated);
  const currentFirstPlayer = activePlayers[context.firstPlayerIndex % activePlayers.length];
  const isNewRound = nextPlayerId === currentFirstPlayer?.id && newTurnNumber > 0;
  const newRoundNumber = isNewRound ? context.roundNumber + 1 : context.roundNumber;

  const newFirstPlayerIndex = isNewRound
    ? (context.firstPlayerIndex + 1) % activePlayers.length
    : context.firstPlayerIndex;

  const actualNextPlayerId = isNewRound ? activePlayers[newFirstPlayerIndex].id : nextPlayerId;

  const newRoundsSinceElimination = isNewRound
    ? context.roundsSinceElimination + 1
    : context.roundsSinceElimination;

  return {
    currentPlayerId: actualNextPlayerId,
    turnNumber: newTurnNumber,
    roundNumber: newRoundNumber,
    firstPlayerIndex: newFirstPlayerIndex,
    roundsSinceElimination: newRoundsSinceElimination,
  };
}

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
export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
    input: {} as GameMachineInput,
  },
  delays: {
    turnTimer: ({ context }: { context: GameMachineContext }) => {
      // Return the turn timer duration, or a very large value if no timer configured.
      // XState v5 requires a number, so we use Infinity-like value when disabled.
      return context.turnTimerMs ?? 2_147_483_647;
    },
  },
  guards: {
    isTurnTimerEnabled: ({ context }: { context: GameMachineContext }) => {
      return context.turnTimerMs !== null;
    },
  },
  actions: {
    autoSkipTurn: assign(({ context }) => {
      return advanceTurnSkip(context);
    }),
    initializeBoard: assign(({ context }) => {
      // Generate board using shared logic
      const playerNames = context.players.map((p) => p.name);
      const generated = createInitialState(playerNames, context.turnTimerMs);

      // Map generated player IDs to the existing lobby player IDs
      const idMap = new Map<string, string>();
      for (let i = 0; i < generated.players.length; i++) {
        idMap.set(generated.players[i].id, context.players[i].id);
      }

      // Remap piece playerIds to match existing lobby players
      const pieces: Piece[] = generated.pieces.map((piece) => ({
        ...piece,
        playerId: piece.playerId ? (idMap.get(piece.playerId) ?? piece.playerId) : null,
      }));

      return {
        ...context,
        pieces,
        phase: 'playing' as const,
        currentPlayerId: context.players[0].id,
      };
    }),
  },
}).createMachine({
  id: 'game',
  type: 'compound' as const,
  initial: 'lobby',
  context: ({ input }: { input: GameMachineInput }): GameMachineContext => ({
    id: input.gameId,
    phase: 'lobby',
    config: input.config,
    players: [],
    pieces: [],
    currentPlayerId: null,
    turnNumber: 0,
    roundNumber: 0,
    firstPlayerIndex: 0,
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
    setup: {
      entry: 'initializeBoard',
      always: {
        target: 'playing',
      },
    },
    playing: {
      initial: 'awaitingMove',
      states: {
        awaitingMove: {
          after: {
            turnTimer: {
              guard: 'isTurnTimerEnabled',
              actions: 'autoSkipTurn',
              target: 'checkingGameEnd',
            },
          },
          on: {
            MAKE_MOVE: [
              {
                guard: ({ context, event }) => {
                  // Must be this player's turn
                  if (event.playerId !== context.currentPlayerId) {
                    return false;
                  }
                  // Apply the move using shared logic - check if valid
                  const result = applyMove(context, event.playerId, event.command);
                  return result.success;
                },
                actions: assign(({ context, event }) => {
                  const result = applyMove(context, event.playerId, event.command);
                  // Merge the new game state into the machine context
                  return {
                    ...context,
                    pieces: result.newState.pieces,
                    players: result.newState.players,
                    currentPlayerId: result.newState.currentPlayerId,
                    turnNumber: result.newState.turnNumber,
                    roundNumber: result.newState.roundNumber,
                    firstPlayerIndex: result.newState.firstPlayerIndex,
                    roundsSinceElimination: result.newState.roundsSinceElimination,
                    winnerId: result.newState.winnerId,
                    winCondition: result.newState.winCondition,
                    phase: result.newState.phase,
                  };
                }),
                target: 'checkingGameEnd',
              },
            ],
          },
        },
        checkingGameEnd: {
          always: [
            {
              guard: ({ context }) => context.winnerId !== null,
              target: '#game.ended',
            },
            {
              target: 'awaitingMove',
            },
          ],
        },
      },
    },
    starvation: {},
    paused: {},
    ended: {
      type: 'final' as const,
    },
  },
});
