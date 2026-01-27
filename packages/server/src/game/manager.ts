import { createActor, type Actor, type Subscription } from 'xstate';
import { gameMachine } from './machine';
import type { GameMachineContext, GameMachineInput } from './types';
import type { GameConfig, MoveCommand, MoveResult } from '@jarls/shared';
import { generateId, applyMove } from '@jarls/shared';
import { saveSnapshot, saveEvent, loadActiveSnapshots } from './persistence';

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
        const persistedSnapshot = actor.getPersistedSnapshot();

        // Fire-and-forget persistence (log errors but don't block the state machine)
        saveSnapshot(gameId, persistedSnapshot, managedGame.version, currentState).catch((err) => {
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

    // Save the initial persisted snapshot to the database
    const initialState = getStateName(actor.getSnapshot().value);
    const persistedSnapshot = actor.getPersistedSnapshot();
    await saveSnapshot(gameId, persistedSnapshot, 1, initialState);

    // Save a GAME_CREATED event
    await saveEvent(gameId, 'GAME_CREATED', {
      config: createConfig.config,
    });

    this.games.set(gameId, managedGame);

    return gameId;
  }

  /**
   * Recover active games from the database on server start.
   * Loads all non-ended game snapshots, recreates XState actors from
   * their persisted state, and adds them to the in-memory Map.
   * Returns the number of games recovered.
   */
  async recover(): Promise<number> {
    const snapshots = await loadActiveSnapshots();
    let recovered = 0;

    for (const snap of snapshots) {
      const gameId = snap.gameId;

      // Skip if already loaded (e.g., created during this session)
      if (this.games.has(gameId)) continue;

      try {
        // The state field contains the full XState persisted snapshot
        const persistedSnapshot = snap.state as ReturnType<GameActor['getPersistedSnapshot']>;

        // XState v5 requires input even when restoring from snapshot.
        // The input is only used for initial context creation, which is
        // skipped when a snapshot is provided, so we pass a dummy input.
        const actor = createActor(gameMachine, {
          snapshot: persistedSnapshot,
          input: {
            gameId,
            config: (persistedSnapshot as unknown as { context: GameMachineContext }).context
              .config,
          },
        });

        const managedGame: ManagedGame = {
          actor,
          subscription: { unsubscribe: () => {} },
          version: snap.version,
          previousStateValue: snap.status,
        };

        // Subscribe to state changes for ongoing persistence
        const subscription = actor.subscribe((snapshot) => {
          const currentState = getStateName(snapshot.value);
          const previousState = managedGame.previousStateValue;

          if (currentState !== previousState) {
            managedGame.version += 1;
            managedGame.previousStateValue = currentState;

            const context = snapshot.context as GameMachineContext;
            const persisted = actor.getPersistedSnapshot();

            saveSnapshot(gameId, persisted, managedGame.version, currentState).catch((err) => {
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
        this.games.set(gameId, managedGame);
        recovered++;
      } catch (err) {
        console.error(`Failed to recover game ${gameId}:`, err);
      }
    }

    return recovered;
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
   * Join a game by adding a player to the lobby.
   * Generates a unique player ID, sends PLAYER_JOINED to the actor,
   * and returns the generated player ID.
   * Throws if the game doesn't exist or is not in the lobby state.
   */
  join(gameId: string, playerName: string): string {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'lobby') {
      throw new Error(`Cannot join game in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (context.players.length >= context.config.playerCount) {
      throw new Error('Game is full');
    }

    const playerId = generateId();
    managed.actor.send({
      type: 'PLAYER_JOINED',
      playerId,
      playerName,
    });

    return playerId;
  }

  /**
   * Remove a player from the game lobby.
   * Sends PLAYER_LEFT to the actor.
   * Throws if the game doesn't exist or is not in the lobby state.
   */
  leave(gameId: string, playerId: string): void {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'lobby') {
      throw new Error(`Cannot leave game in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    const playerExists = context.players.some((p) => p.id === playerId);
    if (!playerExists) {
      throw new Error(`Player not found in game: ${playerId}`);
    }

    managed.actor.send({
      type: 'PLAYER_LEFT',
      playerId,
    });
  }

  /**
   * Start a game. Only the host (first player to join) can start.
   * Sends START_GAME to the actor which transitions from lobby -> setup -> playing.
   * Throws if the game doesn't exist, is not in lobby, player is not host,
   * or there aren't enough players.
   */
  start(gameId: string, playerId: string): void {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'lobby') {
      throw new Error(`Cannot start game in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (context.players.length === 0 || context.players[0].id !== playerId) {
      throw new Error('Only the host can start the game');
    }

    if (context.players.length < 2) {
      throw new Error('Not enough players to start the game');
    }

    managed.actor.send({
      type: 'START_GAME',
      playerId,
    });
  }

  /**
   * Execute a move in a game.
   * Validates preconditions, applies the move using shared logic to get the result,
   * then sends MAKE_MOVE to the actor to update the state machine.
   * Returns the MoveResult with success/failure, new state, and events.
   * Throws if the game doesn't exist or is not in a playing state.
   */
  makeMove(gameId: string, playerId: string, command: MoveCommand): MoveResult {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'playing') {
      throw new Error(`Cannot make move in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (context.currentPlayerId !== playerId) {
      return {
        success: false,
        error: 'Not your turn',
        newState: context,
        events: [],
      };
    }

    // Compute the result using shared logic (same as the machine guard/action)
    const result = applyMove(context, playerId, command);

    if (result.success) {
      // Send the event to the actor to update the state machine
      managed.actor.send({
        type: 'MAKE_MOVE',
        playerId,
        command,
      });
    }

    return result;
  }

  /**
   * Submit a starvation choice for a player.
   * Sends STARVATION_CHOICE to the actor.
   * Throws if the game doesn't exist or is not in the starvation state.
   */
  submitStarvationChoice(gameId: string, playerId: string, pieceId: string): void {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'starvation') {
      throw new Error(`Cannot submit starvation choice in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;

    // Validate the player has candidates
    const playerCandidates = context.starvationCandidates.find((c) => c.playerId === playerId);
    if (!playerCandidates || playerCandidates.candidates.length === 0) {
      throw new Error(`Player has no starvation candidates: ${playerId}`);
    }

    // Validate the selected piece is a valid candidate
    const isValidCandidate = playerCandidates.candidates.some((c) => c.id === pieceId);
    if (!isValidCandidate) {
      throw new Error(`Invalid starvation candidate: ${pieceId}`);
    }

    // Check if the player already submitted a choice
    if (context.starvationChoices.some((sc) => sc.playerId === playerId)) {
      throw new Error(`Player already submitted starvation choice: ${playerId}`);
    }

    managed.actor.send({
      type: 'STARVATION_CHOICE',
      playerId,
      pieceId,
    });
  }

  /**
   * Handle a player disconnecting from the game.
   * Sends PLAYER_DISCONNECTED to the actor, which may pause the game
   * if it's the current player's turn.
   * Throws if the game doesn't exist or is not in a valid state for disconnection.
   */
  onDisconnect(gameId: string, playerId: string): void {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'playing' && stateName !== 'paused' && stateName !== 'starvation') {
      throw new Error(`Cannot disconnect in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    const playerExists = context.players.some((p) => p.id === playerId);
    if (!playerExists) {
      throw new Error(`Player not found in game: ${playerId}`);
    }

    managed.actor.send({
      type: 'PLAYER_DISCONNECTED',
      playerId,
    });
  }

  /**
   * Handle a previously disconnected player reconnecting to the game.
   * Sends PLAYER_RECONNECTED to the actor, which resumes the game
   * if it was paused.
   * Throws if the game doesn't exist or the player wasn't disconnected.
   */
  onReconnect(gameId: string, playerId: string): void {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'playing' && stateName !== 'paused' && stateName !== 'starvation') {
      throw new Error(`Cannot reconnect in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (!context.disconnectedPlayers.has(playerId)) {
      throw new Error(`Player is not disconnected: ${playerId}`);
    }

    managed.actor.send({
      type: 'PLAYER_RECONNECTED',
      playerId,
    });
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
