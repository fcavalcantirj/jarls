import { createActor, type Actor, type Subscription } from 'xstate';
import { gameMachine } from './machine';
import type { GameMachineContext, GameMachineInput } from './types';
import type { GameConfig } from '@jarls/shared';
import { generateId } from '@jarls/shared';
import { saveSnapshot, saveEvent } from './persistence';

/** Summary of a game for listing purposes */
export interface GameSummary {
  gameId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ id: string; name: string }>;
}

/** Configuration for creating a new game */
export interface CreateGameConfig {
  config: GameConfig;
}

type GameActor = Actor<typeof gameMachine>;
type GameSnapshot = ReturnType<GameActor['getSnapshot']>;

/** Internal tracking for a managed game */
interface ManagedGame {
  actor: GameActor;
  subscription: Subscription;
  version: number;
  previousStateValue: string;
}

/**
 * Extract the top-level state name from an XState snapshot value.
 * Handles both simple string values ("lobby") and compound objects ({ playing: "awaitingMove" }).
 */
function getStateName(value: string | Record<string, unknown>): string {
  return typeof value === 'string' ? value : Object.keys(value)[0];
}

/**
 * GameManager manages the lifecycle of game machine actors.
 * It provides a high-level API for creating games, managing players,
 * and executing game actions. Integrates with PostgreSQL persistence
 * to save snapshots and events on each state transition.
 */
export class GameManager {
  private games: Map<string, ManagedGame> = new Map();

  /**
   * Create a new game with the given configuration.
   * Generates a unique game ID, creates an XState actor, starts it,
   * saves the initial snapshot to the database, and subscribes to
   * state changes for ongoing persistence.
   * Returns the generated game ID.
   */
  async create(createConfig: CreateGameConfig): Promise<string> {
    const gameId = generateId();

    const input: GameMachineInput = {
      gameId,
      config: createConfig.config,
    };

    const actor = createActor(gameMachine, { input });

    // Subscribe to state changes BEFORE starting, so we capture transitions
    const managedGame: ManagedGame = {
      actor,
      subscription: { unsubscribe: () => {} },
      version: 1,
      previousStateValue: 'lobby',
    };

    const subscription = actor.subscribe((snapshot) => {
      const currentState = getStateName(snapshot.value);
      const previousState = managedGame.previousStateValue;

      // Only persist when the top-level state actually changes
      if (currentState !== previousState) {
        managedGame.version += 1;
        managedGame.previousStateValue = currentState;

        const context = snapshot.context as GameMachineContext;

        // Fire-and-forget persistence (log errors but don't block the state machine)
        saveSnapshot(gameId, context, managedGame.version, currentState).catch((err) => {
          console.error(`Failed to save snapshot for game ${gameId}:`, err);
        });

        saveEvent(gameId, `STATE_${currentState.toUpperCase()}`, {
          fromState: previousState,
          toState: currentState,
          turnNumber: context.turnNumber,
          roundNumber: context.roundNumber,
        }).catch((err) => {
          console.error(`Failed to save event for game ${gameId}:`, err);
        });
      }
    });

    managedGame.subscription = subscription;

    actor.start();

    // Save the initial snapshot to the database
    const initialSnapshot = actor.getSnapshot();
    const initialContext = initialSnapshot.context as GameMachineContext;
    const initialState = getStateName(initialSnapshot.value);
    await saveSnapshot(gameId, initialContext, 1, initialState);

    // Save a GAME_CREATED event
    await saveEvent(gameId, 'GAME_CREATED', {
      config: createConfig.config,
    });

    this.games.set(gameId, managedGame);

    return gameId;
  }

  /**
   * Get the current state snapshot of a game.
   * Returns the XState snapshot or undefined if the game doesn't exist.
   */
  getState(gameId: string): GameSnapshot | undefined {
    const managed = this.games.get(gameId);
    if (!managed) return undefined;
    return managed.actor.getSnapshot();
  }

  /**
   * List all active games, optionally filtered by status.
   */
  listGames(filter?: { status?: string }): GameSummary[] {
    const summaries: GameSummary[] = [];

    for (const [gameId, managed] of this.games) {
      const snapshot = managed.actor.getSnapshot();
      const context = snapshot.context as GameMachineContext;
      const status = getStateName(snapshot.value);

      if (filter?.status && status !== filter.status) {
        continue;
      }

      summaries.push({
        gameId,
        status,
        playerCount: context.players.length,
        maxPlayers: context.config.playerCount,
        players: context.players.map((p) => ({ id: p.id, name: p.name })),
      });
    }

    return summaries;
  }

  /**
   * Get the actor for a game. Used internally and for testing.
   */
  getActor(gameId: string): GameActor | undefined {
    return this.games.get(gameId)?.actor;
  }

  /**
   * Remove a game from the manager. Stops the actor and unsubscribes.
   */
  remove(gameId: string): boolean {
    const managed = this.games.get(gameId);
    if (!managed) return false;
    managed.subscription.unsubscribe();
    managed.actor.stop();
    this.games.delete(gameId);
    return true;
  }

  /**
   * Get the total number of active games.
   */
  get gameCount(): number {
    return this.games.size;
  }

  /**
   * Stop all game actors, unsubscribe, and clear the manager.
   */
  shutdown(): void {
    for (const [, managed] of this.games) {
      managed.subscription.unsubscribe();
      managed.actor.stop();
    }
    this.games.clear();
  }
}
