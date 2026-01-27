import { createActor, type Actor } from 'xstate';
import { gameMachine } from './machine';
import type { GameMachineContext, GameMachineInput } from './types';
import type { GameConfig } from '@jarls/shared';
import { generateId } from '@jarls/shared';

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

/**
 * GameManager manages the lifecycle of game machine actors.
 * It provides a high-level API for creating games, managing players,
 * and executing game actions.
 */
export class GameManager {
  private games: Map<string, GameActor> = new Map();

  /**
   * Create a new game with the given configuration.
   * Generates a unique game ID, creates an XState actor, and starts it.
   * Returns the generated game ID.
   */
  create(createConfig: CreateGameConfig): string {
    const gameId = generateId();

    const input: GameMachineInput = {
      gameId,
      config: createConfig.config,
    };

    const actor = createActor(gameMachine, { input });
    actor.start();

    this.games.set(gameId, actor);

    return gameId;
  }

  /**
   * Get the current state snapshot of a game.
   * Returns the XState snapshot or undefined if the game doesn't exist.
   */
  getState(gameId: string): GameSnapshot | undefined {
    const actor = this.games.get(gameId);
    if (!actor) return undefined;
    return actor.getSnapshot();
  }

  /**
   * List all active games, optionally filtered by status.
   */
  listGames(filter?: { status?: string }): GameSummary[] {
    const summaries: GameSummary[] = [];

    for (const [gameId, actor] of this.games) {
      const snapshot = actor.getSnapshot();
      const context = snapshot.context as GameMachineContext;
      const status =
        typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];

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
    return this.games.get(gameId);
  }

  /**
   * Remove a game from the manager. Stops the actor.
   */
  remove(gameId: string): boolean {
    const actor = this.games.get(gameId);
    if (!actor) return false;
    actor.stop();
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
   * Stop all game actors and clear the manager.
   */
  shutdown(): void {
    for (const [, actor] of this.games) {
      actor.stop();
    }
    this.games.clear();
  }
}
