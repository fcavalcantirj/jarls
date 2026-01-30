import { createActor, type Actor, type Subscription } from 'xstate';
import { gameMachine } from './machine';
import type { GameMachineContext, GameMachineInput } from './types';
import type {
  GameConfig,
  GameState,
  MoveCommand,
  MoveResult,
  Piece,
  AIConfig,
} from '@jarls/shared';
import { generateId, applyMove } from '@jarls/shared';
import { saveSnapshot, saveEvent, loadActiveSnapshots } from './persistence';
import { query } from '../db/pool';
import type { AIPlayer, AIDifficulty, ConfigurableAIPlayer } from '../ai/types';
import { RandomAI } from '../ai/random';
import { HeuristicAI } from '../ai/heuristic-ai';
import { GroqAI } from '../ai/groq-ai';
import { generateNorseName } from '../ai/names';
import { ConfigurationError } from '../errors/index';

/**
 * Validate game state integrity - check for corrupted state like duplicate positions.
 * Returns an error message if validation fails, or null if state is valid.
 */
function validateGameState(pieces: Piece[]): string | null {
  const positionMap = new Map<string, string[]>();

  for (const piece of pieces) {
    const key = `${piece.position.q},${piece.position.r}`;
    const existing = positionMap.get(key) || [];
    existing.push(piece.id);
    positionMap.set(key, existing);
  }

  // Check for duplicate positions
  for (const [pos, pieceIds] of positionMap) {
    if (pieceIds.length > 1) {
      return `CORRUPTED STATE: Multiple pieces at position ${pos}: ${pieceIds.join(', ')}`;
    }
  }

  return null;
}

/** Summary of a game for listing purposes */
export interface GameSummary {
  gameId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  players: Array<{ id: string; name: string }>;
  turnTimerMs: number | null;
  boardRadius: number;
  createdAt: string;
}

/** Stats for the dashboard */
export interface GameStats {
  totalGames: number;
  openLobbies: number;
  gamesInProgress: number;
  gamesEnded: number;
}

/** Configuration for creating a new game */
export interface CreateGameConfig {
  config: GameConfig;
}

type GameActor = Actor<typeof gameMachine>;
type GameSnapshot = ReturnType<GameActor['getSnapshot']>;

/** Tracks an AI player associated with a game */
interface ManagedAIPlayer {
  playerId: string;
  ai: AIPlayer;
}

/** Internal tracking for a managed game */
interface ManagedGame {
  actor: GameActor;
  subscription: Subscription;
  version: number;
  previousStateValue: string;
  aiPlayers: ManagedAIPlayer[];
  createdAt: Date;
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
/** Callback type for AI move notifications */
export type AIMovedCallback = (gameId: string, result: MoveResult) => void;

export class GameManager {
  private games: Map<string, ManagedGame> = new Map();
  private pendingAIMoves: Set<string> = new Set();
  /** Per-game mutex locks to serialize move processing and prevent race conditions */
  private moveLocks: Map<string, Promise<void>> = new Map();
  /** Callbacks to notify when AI makes a move (for socket broadcasting) */
  private aiMoveCallbacks: AIMovedCallback[] = [];

  /**
   * Register a callback to be called when an AI player makes a move.
   * Used by socket handlers to broadcast turnPlayed events.
   */
  onAIMove(callback: AIMovedCallback): void {
    this.aiMoveCallbacks.push(callback);
  }

  /**
   * Notify all registered callbacks that an AI made a move.
   */
  private notifyAIMove(gameId: string, result: MoveResult): void {
    for (const callback of this.aiMoveCallbacks) {
      try {
        callback(gameId, result);
      } catch (err) {
        console.error('Error in AI move callback:', err);
      }
    }
  }

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
      aiPlayers: [],
      createdAt: new Date(),
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

      // Trigger AI moves when it's an AI player's turn
      this.handleAITurn(gameId, managedGame, snapshot);
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
        const context = (persistedSnapshot as unknown as { context: GameMachineContext }).context;

        // Validate state integrity before recovering
        const validationError = validateGameState(context.pieces);
        if (validationError) {
          console.error(`Skipping corrupted game ${gameId}: ${validationError}`);
          continue;
        }

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
          aiPlayers: [],
          createdAt: snap.createdAt ?? new Date(),
        };

        // Recreate AI player instances for players marked as AI
        for (const player of context.players) {
          if (player.isAI) {
            const apiKey = process.env.GROQ_API_KEY;
            // Default to Groq AI if API key available, otherwise use random
            const ai = apiKey ? new GroqAI(apiKey) : new RandomAI(500, 1500);
            managedGame.aiPlayers.push({ playerId: player.id, ai });
            console.log(`Recovered AI player ${player.name} (${player.id}) for game ${gameId}`);
          }
        }

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

          // Trigger AI moves when it's an AI player's turn
          this.handleAITurn(gameId, managedGame, snapshot);
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
        turnTimerMs: context.config.turnTimerMs,
        boardRadius: context.config.boardRadius,
        createdAt: managed.createdAt.toISOString(),
      });
    }

    return summaries;
  }

  /**
   * Ping the database to wake it up (useful for Railway's sleeping Postgres).
   * Returns true if successful, throws on error.
   */
  async pingDatabase(): Promise<boolean> {
    await query('SELECT 1');
    return true;
  }

  /**
   * Get stats for the dashboard.
   * openLobbies only counts joinable lobbies (not full, not stale >1hr).
   */
  getStats(): GameStats {
    let openLobbies = 0;
    let gamesInProgress = 0;
    let gamesEnded = 0;
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();

    for (const [, managed] of this.games) {
      const snapshot = managed.actor.getSnapshot();
      const context = snapshot.context as GameMachineContext;
      const status = getStateName(snapshot.value);

      switch (status) {
        case 'lobby': {
          // Only count joinable lobbies (not full, not stale)
          const isFull = context.players.length >= context.config.playerCount;
          const isStale = now - managed.createdAt.getTime() > ONE_HOUR;
          if (!isFull && !isStale) {
            openLobbies++;
          }
          break;
        }
        case 'playing':
        case 'paused':
        case 'starvation':
          gamesInProgress++;
          break;
        case 'ended':
          gamesEnded++;
          break;
      }
    }

    return {
      totalGames: this.games.size,
      openLobbies,
      gamesInProgress,
      gamesEnded,
    };
  }

  /**
   * Join a game by adding a player to the lobby.
   * Generates a unique player ID, sends PLAYER_JOINED to the actor,
   * and returns the generated player ID.
   * Throws if the game doesn't exist or is not in the lobby state.
   */
  join(gameId: string, playerName: string, isAI = false): string {
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
      isAI,
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
   *
   * Uses a per-game mutex lock to serialize move processing and prevent
   * race conditions where rapid moves from the same player both pass validation.
   */
  async makeMove(
    gameId: string,
    playerId: string,
    command: MoveCommand,
    turnNumber?: number
  ): Promise<MoveResult> {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    // Proper mutex: set our lock BEFORE waiting on the previous one
    // This prevents race conditions where two requests both pass the check
    const previousLock = this.moveLocks.get(gameId) ?? Promise.resolve();

    let unlock: () => void;
    const ourLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });

    // Set our lock immediately - anyone coming after us will chain onto this
    this.moveLocks.set(gameId, ourLock);

    // Now wait for the previous operation to complete
    await previousLock;

    try {
      // Re-fetch snapshot AFTER acquiring lock to ensure fresh state
      const snapshot = managed.actor.getSnapshot();

      // DEBUG: Log move attempt with destination details
      const ctx = snapshot.context as GameMachineContext;
      const destPiece = ctx.pieces.find(
        (p) => p.position.q === command.destination.q && p.position.r === command.destination.r
      );
      console.log(
        `[MOVE] Player ${playerId} attempting move. Current turn: ${ctx.turnNumber}, currentPlayer: ${ctx.currentPlayerId}`
      );
      console.log(
        `[MOVE] pieceId=${command.pieceId} dest=(${command.destination.q},${command.destination.r}) destPiece=${destPiece ? `${destPiece.id}(owner=${destPiece.playerId})` : 'empty'}`
      );
      const stateName = getStateName(snapshot.value);
      if (stateName !== 'playing') {
        return {
          success: false,
          error: `Cannot make move in state: ${stateName}`,
          newState: snapshot.context as GameMachineContext,
          events: [],
        };
      }

      const context = snapshot.context as GameMachineContext;

      // Validate turn number if provided (detects stale requests)
      if (turnNumber !== undefined && turnNumber !== context.turnNumber) {
        return {
          success: false,
          error: 'Stale move request',
          newState: context,
          events: [],
        };
      }

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
        // Validate result state integrity BEFORE applying
        const validationError = validateGameState(result.newState.pieces);
        if (validationError) {
          console.error(`[MOVE CORRUPTED] ${validationError}`);
          // Don't apply the corrupted state - return error
          return {
            success: false,
            error: 'Internal error: move would corrupt game state',
            newState: context,
            events: [],
          };
        }

        // Send the event to the actor to update the state machine
        managed.actor.send({
          type: 'MAKE_MOVE',
          playerId,
          command,
        });

        // DEBUG: Log successful move with events
        const afterSnapshot = managed.actor.getSnapshot();
        const afterCtx = afterSnapshot.context as GameMachineContext;
        console.log(
          `[MOVE SUCCESS] Turn advanced to: ${afterCtx.turnNumber}, next player: ${afterCtx.currentPlayerId}`
        );
        console.log(`[MOVE EVENTS] ${result.events.length} event(s):`);
        result.events.forEach((e, i) => console.log(`  [${i}] ${JSON.stringify(e)}`));
      } else {
        console.log(`[MOVE FAILED] ${result.error}`);
      }

      return result;
    } finally {
      // Release our lock (allows next waiter to proceed)
      unlock!();
      // Only clean up if we're still the current lock
      if (this.moveLocks.get(gameId) === ourLock) {
        this.moveLocks.delete(gameId);
      }
    }
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
   * Add an AI player to a game in the lobby.
   * Creates an AI instance based on difficulty, joins the game with a Norse name,
   * and tracks the AI player for automatic move generation.
   * Returns the generated player ID for the AI.
   */
  addAIPlayer(gameId: string, difficulty: AIDifficulty): string {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'lobby') {
      throw new Error(`Cannot add AI player in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (context.players.length >= context.config.playerCount) {
      throw new Error('Game is full');
    }

    // Create AI instance based on difficulty
    let ai: AIPlayer;
    if (difficulty === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new ConfigurationError('Groq AI is not available - GROQ_API_KEY not configured');
      }
      ai = new GroqAI(apiKey);
    } else if (difficulty === 'heuristic') {
      ai = new HeuristicAI(500, 1500);
    } else {
      ai = new RandomAI(500, 1500);
    }

    // Join as a player with a Norse name (marked as AI)
    const playerName = generateNorseName();
    const playerId = this.join(gameId, playerName, true);

    // Track the AI player
    managed.aiPlayers.push({ playerId, ai });

    return playerId;
  }

  /**
   * Add an AI player to a game with full configuration.
   * Creates an AI instance based on config, joins the game with a Norse name,
   * and tracks the AI player for automatic move generation.
   * Returns the generated player ID for the AI.
   */
  addAIPlayerWithConfig(gameId: string, config: AIConfig): string {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const snapshot = managed.actor.getSnapshot();
    const stateName = getStateName(snapshot.value);
    if (stateName !== 'lobby') {
      throw new Error(`Cannot add AI player in state: ${stateName}`);
    }

    const context = snapshot.context as GameMachineContext;
    if (context.players.length >= context.config.playerCount) {
      throw new Error('Game is full');
    }

    // Create AI instance based on config
    let ai: AIPlayer;
    if (config.type === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new ConfigurationError('Groq AI is not available - GROQ_API_KEY not configured');
      }
      ai = new GroqAI(apiKey, config);
    } else {
      // Local AI uses heuristic
      ai = new HeuristicAI(500, 1500);
    }

    // Join as a player with a Norse name (marked as AI)
    const playerName = generateNorseName();
    const playerId = this.join(gameId, playerName, true); // BUG FIX: was missing isAI=true

    // Track the AI player
    managed.aiPlayers.push({ playerId, ai });

    return playerId;
  }

  /**
   * Update the AI configuration for an AI player mid-game.
   * Only works for Groq AI players that implement ConfigurableAIPlayer.
   * Returns the updated configuration.
   */
  updateAIConfig(gameId: string, playerId: string, config: Partial<AIConfig>): AIConfig {
    const managed = this.games.get(gameId);
    if (!managed) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const aiPlayer = managed.aiPlayers.find((ap) => ap.playerId === playerId);
    if (!aiPlayer) {
      throw new Error(`No AI player found with ID: ${playerId}`);
    }

    // Check if the AI supports configuration updates
    if (!this.isConfigurableAI(aiPlayer.ai)) {
      throw new Error('This AI type does not support configuration updates');
    }

    // Update the configuration
    aiPlayer.ai.updateConfig(config);

    return aiPlayer.ai.getConfig();
  }

  /**
   * Get the current AI configuration for an AI player.
   */
  getAIConfig(gameId: string, playerId: string): AIConfig | null {
    const managed = this.games.get(gameId);
    if (!managed) return null;

    const aiPlayer = managed.aiPlayers.find((ap) => ap.playerId === playerId);
    if (!aiPlayer) return null;

    if (this.isConfigurableAI(aiPlayer.ai)) {
      return aiPlayer.ai.getConfig();
    }

    // For non-configurable AI, return a default config
    return {
      type: 'local',
      difficulty: 'intermediate',
    };
  }

  /**
   * Check if an AI player implements ConfigurableAIPlayer interface.
   */
  private isConfigurableAI(ai: AIPlayer): ai is ConfigurableAIPlayer {
    return 'getConfig' in ai && 'updateConfig' in ai;
  }

  /**
   * Check if a player is an AI player in the given game.
   */
  isAIPlayer(gameId: string, playerId: string): boolean {
    const managed = this.games.get(gameId);
    if (!managed) return false;
    return managed.aiPlayers.some((ap) => ap.playerId === playerId);
  }

  /**
   * Get the AI player ID for a game, if any.
   * Returns the first AI player found, or null if none.
   */
  getAIPlayerId(gameId: string): string | null {
    const managed = this.games.get(gameId);
    if (!managed || managed.aiPlayers.length === 0) return null;
    return managed.aiPlayers[0].playerId;
  }

  /**
   * Handle AI turn: if the current player is an AI, generate and execute a move.
   * Called from the actor subscription whenever state changes.
   */
  private handleAITurn(gameId: string, managedGame: ManagedGame, snapshot: GameSnapshot): void {
    const stateValue = snapshot.value;
    const context = snapshot.context as GameMachineContext;

    // DEBUG: Log every call to handleAITurn
    console.log(
      `[handleAITurn] gameId=${gameId} state=${JSON.stringify(stateValue)} currentPlayer=${context.currentPlayerId} turn=${context.turnNumber} aiPlayers=[${managedGame.aiPlayers.map((ap) => ap.playerId).join(',')}]`
    );

    // Check if we're in the awaitingMove substate of playing
    const isAwaitingMove =
      typeof stateValue === 'object' &&
      stateValue !== null &&
      'playing' in stateValue &&
      (stateValue as Record<string, string>).playing === 'awaitingMove';

    if (!isAwaitingMove) {
      console.log(`[handleAITurn] Not in awaitingMove state, skipping`);
      // Also handle starvation state for AI players
      this.handleAIStarvation(gameId, managedGame, snapshot);
      return;
    }

    const currentPlayerId = context.currentPlayerId;
    if (!currentPlayerId) {
      console.log(`[handleAITurn] No currentPlayerId, skipping`);
      return;
    }

    const aiPlayer = managedGame.aiPlayers.find((ap) => ap.playerId === currentPlayerId);
    console.log(
      `[handleAITurn] Looking for AI player ${currentPlayerId} in aiPlayers: found=${!!aiPlayer}`
    );
    if (!aiPlayer) {
      // Log when we expect AI to play but can't find it
      const currentPlayerData = context.players.find((p) => p.id === currentPlayerId);
      if (currentPlayerData?.isAI) {
        console.error(
          `[AI BUG] Player ${currentPlayerId} (${currentPlayerData.name}) is marked isAI but not in aiPlayers array!`,
          `aiPlayers: ${managedGame.aiPlayers.map((ap) => ap.playerId).join(', ') || 'empty'}`
        );
      }
      return;
    }

    console.log(
      `[AI TURN] AI player ${aiPlayer.playerId} generating move for turn ${context.turnNumber}`
    );

    // Avoid triggering multiple AI moves concurrently
    const aiKey = `${gameId}:${currentPlayerId}:${context.turnNumber}`;
    if (this.pendingAIMoves.has(aiKey)) return;
    this.pendingAIMoves.add(aiKey);

    // Generate and execute the AI move asynchronously
    const gameState = context as GameState;
    const timeoutMs = 10000; // 10 seconds for Groq API calls

    const movePromise = Promise.race([
      aiPlayer.ai.generateMove(gameState, currentPlayerId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), timeoutMs)
      ),
    ]);

    movePromise
      .then(async (command) => {
        console.log(
          `[AI MOVE] Generated: pieceId=${command.pieceId} dest=(${command.destination.q},${command.destination.r})`
        );
        // Verify the game is still in the right state before making the move
        const currentSnapshot = managedGame.actor.getSnapshot();
        const currentContext = currentSnapshot.context as GameMachineContext;
        if (
          currentContext.currentPlayerId === currentPlayerId &&
          currentContext.turnNumber === context.turnNumber
        ) {
          const result = await this.makeMove(gameId, currentPlayerId, command, context.turnNumber);
          console.log(`[AI MOVE RESULT] success=${result.success} error=${result.error ?? 'none'}`);
          // Notify callbacks so socket handlers can broadcast to clients
          if (result.success) {
            this.notifyAIMove(gameId, result);
          }
        } else {
          console.warn(
            `[AI MOVE SKIPPED] State changed: expected turn ${context.turnNumber}, got ${currentContext.turnNumber}`
          );
        }
      })
      .catch((err) => {
        console.error(`AI move failed for game ${gameId}, player ${currentPlayerId}:`, err);
        // Fallback: try a random move
        const fallbackAI = new RandomAI(0, 0);
        fallbackAI
          .generateMove(gameState, currentPlayerId)
          .then(async (fallbackCommand) => {
            const currentSnapshot = managedGame.actor.getSnapshot();
            const currentContext = currentSnapshot.context as GameMachineContext;
            if (
              currentContext.currentPlayerId === currentPlayerId &&
              currentContext.turnNumber === context.turnNumber
            ) {
              const result = await this.makeMove(
                gameId,
                currentPlayerId,
                fallbackCommand,
                context.turnNumber
              );
              if (result.success) {
                this.notifyAIMove(gameId, result);
              }
            }
          })
          .catch((fallbackErr) => {
            console.error(`AI fallback also failed for game ${gameId}:`, fallbackErr);
          });
      })
      .finally(() => {
        this.pendingAIMoves.delete(aiKey);
      });
  }

  /**
   * Handle AI starvation choices when the game enters starvation state.
   */
  private handleAIStarvation(
    gameId: string,
    managedGame: ManagedGame,
    snapshot: GameSnapshot
  ): void {
    const stateValue = snapshot.value;
    const context = snapshot.context as GameMachineContext;

    // Check if we're in the starvation.awaitingChoices substate
    const isAwaitingStarvation =
      typeof stateValue === 'object' &&
      stateValue !== null &&
      'starvation' in stateValue &&
      (stateValue as Record<string, string>).starvation === 'awaitingChoices';

    if (!isAwaitingStarvation) return;

    // For each AI player that has candidates and hasn't submitted a choice yet
    for (const aiPlayer of managedGame.aiPlayers) {
      const hasCandidates = context.starvationCandidates.some(
        (c) => c.playerId === aiPlayer.playerId && c.candidates.length > 0
      );
      const alreadyChosen = context.starvationChoices.some(
        (sc) => sc.playerId === aiPlayer.playerId
      );

      if (!hasCandidates || alreadyChosen) continue;

      const starvationKey = `starvation:${gameId}:${aiPlayer.playerId}:${context.roundNumber}`;
      if (this.pendingAIMoves.has(starvationKey)) continue;
      this.pendingAIMoves.add(starvationKey);

      aiPlayer.ai
        .makeStarvationChoice(context.starvationCandidates, aiPlayer.playerId)
        .then((choice) => {
          this.submitStarvationChoice(gameId, choice.playerId, choice.pieceId);
        })
        .catch((err) => {
          console.error(`AI starvation choice failed for game ${gameId}:`, err);
        })
        .finally(() => {
          this.pendingAIMoves.delete(starvationKey);
        });
    }
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
