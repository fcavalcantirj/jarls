# Phase 2: Game State Machine

## Overview

Implement XState v5 state machine for game lifecycle management with PostgreSQL persistence.

**Prerequisites:** Phase 1 complete
**Estimated Effort:** 3-4 days
**Package:** `@jarls/server`

---

## Task 2.1: XState Machine Definition

### Description
Define the complete game state machine with all states, transitions, guards, and actions.

### Work Items
- [ ] Install XState v5: `npm install xstate`
- [ ] Define machine input types
- [ ] Define all states: lobby, setup, playing (with substates), starvation, ended
- [ ] Define all events (PLAYER_JOINED, START_GAME, MAKE_MOVE, END_TURN, etc.)
- [ ] Define guards (isPlayersTurn, isValidMove, hasEnoughPlayers, etc.)
- [ ] Define actions (addPlayer, applyMove, advanceTurn, etc.)
- [ ] Configure turn timer with `after` transitions
- [ ] Define context initialization

### State Diagram
```
                    ┌─────────┐
                    │  lobby  │
                    └────┬────┘
                         │ START_GAME
                         │ [hasEnoughPlayers]
                    ┌────▼────┐
                    │  setup  │
                    └────┬────┘
                         │ always
        ┌────────────────▼────────────────┐
        │            playing              │
        │  ┌──────────────────────────┐   │
        │  │      awaitingMove        │◄──┼───┐
        │  └─────────────┬────────────┘   │   │
        │                │ END_TURN       │   │
        │                │ [isPlayersTurn]│   │
        │  ┌─────────────▼────────────┐   │   │
        │  │       turnEnding         │───┼───┘
        │  └─────────────┬────────────┘   │ [!isGameOver && !hasStarvation]
        │                │                │
        └────────────────┼────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    [hasStarvation]  [isGameOver]        │
         │               │               │
    ┌────▼────┐     ┌────▼────┐          │
    │starvation│────►│  ended  │          │
    └─────────┘     └─────────┘          │
         │ [!isGameOver]                  │
         └────────────────────────────────┘
```

### Machine Definition
```typescript
import { setup, assign, createActor, and, not } from 'xstate';
import { GameState, GameEvent, MoveCommand, Player } from '@jarls/shared';

interface MachineContext extends GameState {}

type MachineEvent =
  | { type: 'PLAYER_JOINED'; playerId: string; name: string }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'START_GAME' }
  | { type: 'MAKE_MOVE'; playerId: string; command: MoveCommand }
  | { type: 'END_TURN'; playerId: string }
  | { type: 'SURRENDER'; playerId: string }
  | { type: 'STARVATION_CHOICE'; playerId: string; pieceId: string }
  | { type: 'TURN_TIMEOUT' };

const gameMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
    input: {} as { gameId: string; config: GameConfig }
  },

  guards: {
    hasEnoughPlayers: ({ context }) =>
      context.players.filter(p => !p.isEliminated).length >= 2,

    isPlayersTurn: ({ context, event }) => {
      if (!('playerId' in event)) return false;
      const currentPlayer = context.players[context.currentPlayerIndex];
      return currentPlayer?.id === event.playerId && !currentPlayer.isEliminated;
    },

    isValidMove: ({ context, event }) => {
      if (event.type !== 'MAKE_MOVE') return false;
      const result = validateMove(context, event.playerId, event.command);
      return result.valid;
    },

    isGameOver: ({ context }) => context.winner !== null,

    hasStarvation: ({ context }) =>
      context.roundsWithoutElimination >= context.config.starvationRounds,

    allStarvationChoicesMade: ({ context }) =>
      context.pendingStarvation?.every(c => c.choice !== undefined) ?? false
  },

  actions: {
    addPlayer: assign({ /* ... */ }),
    removePlayer: assign({ /* ... */ }),
    initializeBoard: assign({ /* ... */ }),
    applyMove: assign({ /* ... */ }),
    advanceTurn: assign({ /* ... */ }),
    checkWinConditions: assign({ /* ... */ }),
    triggerStarvation: assign({ /* ... */ }),
    resolveStarvation: assign({ /* ... */ }),
    recordStarvationChoice: assign({ /* ... */ }),
    setWinner: assign({ /* ... */ })
  },

  delays: {
    turnTimeout: ({ context }) =>
      (context.config.turnTimerSeconds ?? 60) * 1000
  }
}).createMachine({
  id: 'jarlsGame',
  initial: 'lobby',
  context: ({ input }) => createInitialContext(input),

  states: {
    lobby: {
      on: {
        PLAYER_JOINED: { actions: 'addPlayer' },
        PLAYER_LEFT: { actions: 'removePlayer' },
        START_GAME: {
          guard: 'hasEnoughPlayers',
          target: 'setup'
        }
      }
    },

    setup: {
      entry: 'initializeBoard',
      always: { target: 'playing' }
    },

    playing: {
      initial: 'awaitingMove',
      states: {
        awaitingMove: {
          after: {
            turnTimeout: {
              target: 'turnEnding',
              actions: 'advanceTurn'
            }
          },
          on: {
            MAKE_MOVE: {
              guard: and(['isPlayersTurn', 'isValidMove']),
              actions: ['applyMove', 'checkWinConditions'],
              target: 'turnEnding'
            },
            END_TURN: {
              guard: 'isPlayersTurn',
              target: 'turnEnding'
            },
            SURRENDER: {
              guard: 'isPlayersTurn',
              actions: ['eliminatePlayer', 'checkWinConditions'],
              target: 'turnEnding'
            }
          }
        },
        turnEnding: {
          entry: 'advanceTurn',
          always: [
            { guard: 'isGameOver', target: '#jarlsGame.ended' },
            { guard: 'hasStarvation', target: '#jarlsGame.starvation' },
            { target: 'awaitingMove' }
          ]
        }
      }
    },

    starvation: {
      entry: 'triggerStarvation',
      on: {
        STARVATION_CHOICE: {
          actions: 'recordStarvationChoice'
        }
      },
      always: [
        {
          guard: and(['allStarvationChoicesMade']),
          actions: ['resolveStarvation', 'checkWinConditions'],
          target: 'playing'
        }
      ]
    },

    ended: {
      type: 'final',
      entry: 'setWinner'
    }
  }
});
```

### Definition of Done
- [ ] Machine compiles without TypeScript errors
- [ ] All states reachable via valid transitions
- [ ] Guards prevent all invalid transitions
- [ ] Turn timer triggers timeout correctly
- [ ] Machine matches ruleset v0.4.1

### Test Cases
```typescript
describe('Game State Machine', () => {
  test('starts in lobby state', () => {
    const actor = createActor(gameMachine, { input: defaultInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('lobby');
  });

  test('transitions to setup when enough players and START_GAME', () => {
    const actor = createActor(gameMachine, { input: defaultInput });
    actor.start();

    actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', name: 'Alice' });
    actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', name: 'Bob' });
    actor.send({ type: 'START_GAME' });

    expect(actor.getSnapshot().value).toEqual({ playing: 'awaitingMove' });
  });

  test('blocks START_GAME without enough players', () => {
    const actor = createActor(gameMachine, { input: defaultInput });
    actor.start();

    actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', name: 'Alice' });
    actor.send({ type: 'START_GAME' });

    expect(actor.getSnapshot().value).toBe('lobby');
  });

  test('blocks move from wrong player', () => {
    const actor = createStartedGame();
    const beforeContext = actor.getSnapshot().context;

    // p2 tries to move on p1's turn
    actor.send({
      type: 'MAKE_MOVE',
      playerId: 'p2',
      command: { pieceId: 'p2_w1', to: { q: 1, r: 0 } }
    });

    expect(actor.getSnapshot().context).toEqual(beforeContext);
  });

  test('transitions to ended on throne victory', () => {
    const actor = createGameNearThrone();

    actor.send({
      type: 'MAKE_MOVE',
      playerId: 'p1',
      command: { pieceId: 'p1_j', to: THRONE }
    });

    expect(actor.getSnapshot().value).toBe('ended');
    expect(actor.getSnapshot().context.winner).toBe('p1');
  });

  test('turn timer advances turn', async () => {
    const actor = createStartedGame({ turnTimerSeconds: 1 });

    await new Promise(r => setTimeout(r, 1100));

    expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);
  });
});
```

---

## Task 2.2: Game Persistence

### Description
Implement save/restore for game state using PostgreSQL.

### Work Items
- [ ] Implement `GamePersistence` class
- [ ] Implement `save(gameId, actor, event?)` → saves snapshot + event
- [ ] Implement `restore(gameId)` → returns actor with restored state
- [ ] Implement `replayFromEvents(gameId)` → replay for debugging
- [ ] Handle concurrent save attempts (optimistic locking)
- [ ] Implement transaction wrapper

### Persistence Service
```typescript
import { Pool } from 'pg';
import { createActor, ActorRefFrom } from 'xstate';
import { gameMachine } from './machine';

export class GamePersistence {
  constructor(private pool: Pool) {}

  async save(
    gameId: string,
    actor: ActorRefFrom<typeof gameMachine>,
    event?: MachineEvent
  ): Promise<void> {
    const snapshot = actor.getPersistedSnapshot();
    const version = snapshot.context.turnNumber;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Optimistic locking: version must match
      const result = await client.query(`
        UPDATE game_snapshots
        SET state_snapshot = $2, version = $3, updated_at = now(), status = $4
        WHERE game_id = $1 AND version = $3 - 1
        RETURNING *
      `, [gameId, JSON.stringify(snapshot), version, snapshot.value]);

      if (result.rowCount === 0) {
        // Either doesn't exist or version mismatch
        const exists = await client.query(
          'SELECT version FROM game_snapshots WHERE game_id = $1',
          [gameId]
        );

        if (exists.rowCount === 0) {
          // First save
          await client.query(`
            INSERT INTO game_snapshots (game_id, state_snapshot, version, status)
            VALUES ($1, $2, $3, $4)
          `, [gameId, JSON.stringify(snapshot), version, snapshot.value]);
        } else {
          throw new Error(`Version conflict: expected ${exists.rows[0].version + 1}, got ${version}`);
        }
      }

      // Append event to log
      if (event) {
        await client.query(`
          INSERT INTO game_events (game_id, event_type, payload, version)
          VALUES ($1, $2, $3, $4)
        `, [gameId, event.type, JSON.stringify(event), version]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async restore(gameId: string): Promise<ActorRefFrom<typeof gameMachine> | null> {
    const result = await this.pool.query(
      'SELECT state_snapshot FROM game_snapshots WHERE game_id = $1',
      [gameId]
    );

    if (result.rowCount === 0) return null;

    const snapshot = JSON.parse(result.rows[0].state_snapshot);
    const actor = createActor(gameMachine, { snapshot });
    actor.start();
    return actor;
  }

  async replayFromEvents(gameId: string): Promise<ActorRefFrom<typeof gameMachine>> {
    // Get initial config
    const configResult = await this.pool.query(
      'SELECT state_snapshot FROM game_snapshots WHERE game_id = $1',
      [gameId]
    );
    const initialSnapshot = JSON.parse(configResult.rows[0].state_snapshot);

    // Get all events in order
    const eventsResult = await this.pool.query(
      'SELECT payload FROM game_events WHERE game_id = $1 ORDER BY version',
      [gameId]
    );

    // Create fresh actor and replay
    const actor = createActor(gameMachine, {
      input: { gameId, config: initialSnapshot.context.config }
    });
    actor.start();

    for (const row of eventsResult.rows) {
      const event = JSON.parse(row.payload);
      actor.send(event);
    }

    return actor;
  }

  async getEventHistory(gameId: string): Promise<MachineEvent[]> {
    const result = await this.pool.query(
      'SELECT payload, created_at FROM game_events WHERE game_id = $1 ORDER BY version',
      [gameId]
    );
    return result.rows.map(r => ({
      ...JSON.parse(r.payload),
      timestamp: r.created_at
    }));
  }
}
```

### Definition of Done
- [ ] Game survives server restart
- [ ] Event log captures all game events
- [ ] Replay produces identical state to snapshot
- [ ] Concurrent saves don't corrupt data
- [ ] Version conflicts detected and reported

### Test Cases
```typescript
describe('Game Persistence', () => {
  let persistence: GamePersistence;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    persistence = new GamePersistence(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  test('save and restore game', async () => {
    const actor1 = createActor(gameMachine, { input: testInput });
    actor1.start();
    actor1.send({ type: 'PLAYER_JOINED', playerId: 'p1', name: 'Alice' });

    await persistence.save('test-game-1', actor1);

    const actor2 = await persistence.restore('test-game-1');
    expect(actor2?.getSnapshot().context.players).toHaveLength(1);
    expect(actor2?.getSnapshot().context.players[0].name).toBe('Alice');
  });

  test('event replay matches snapshot', async () => {
    const actor = createStartedGameWithMoves();
    await persistence.save('test-game-2', actor);

    const replayed = await persistence.replayFromEvents('test-game-2');
    const restored = await persistence.restore('test-game-2');

    expect(replayed.getSnapshot().context).toEqual(restored?.getSnapshot().context);
  });

  test('handles concurrent save conflict', async () => {
    const actor1 = await persistence.restore('test-game-1');
    const actor2 = await persistence.restore('test-game-1');

    actor1?.send({ type: 'PLAYER_JOINED', playerId: 'p2', name: 'Bob' });
    actor2?.send({ type: 'PLAYER_JOINED', playerId: 'p3', name: 'Charlie' });

    await persistence.save('test-game-1', actor1!);

    await expect(persistence.save('test-game-1', actor2!))
      .rejects.toThrow('Version conflict');
  });
});
```

---

## Task 2.3: Game Manager

### Description
Manage multiple concurrent games in memory with persistence backing.

### Work Items
- [ ] Implement `GameManager` class
- [ ] Implement `create(config)` → creates new game
- [ ] Implement `join(gameId, playerName)` → adds player to lobby
- [ ] Implement `start(gameId)` → starts game
- [ ] Implement `makeMove(gameId, playerId, command)` → executes move
- [ ] Implement `getState(gameId)` → returns current state
- [ ] Implement `listGames(filter?)` → returns joinable games
- [ ] Implement game cleanup on end
- [ ] Implement recovery on server start

### Game Manager
```typescript
import { createActor, ActorRefFrom } from 'xstate';
import { v4 as uuid } from 'uuid';
import { gameMachine } from './machine';
import { GamePersistence } from './persistence';
import { GameConfig, GameState, MoveCommand } from '@jarls/shared';

export class GameManager {
  private games = new Map<string, ActorRefFrom<typeof gameMachine>>();

  constructor(private persistence: GamePersistence) {}

  async create(config: Partial<GameConfig> = {}): Promise<{ gameId: string }> {
    const gameId = uuid();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    const actor = createActor(gameMachine, {
      input: { gameId, config: fullConfig }
    });
    actor.start();

    // Subscribe to state changes for persistence
    actor.subscribe(async (snapshot) => {
      await this.persistence.save(gameId, actor);
    });

    this.games.set(gameId, actor);
    await this.persistence.save(gameId, actor);

    return { gameId };
  }

  async join(
    gameId: string,
    playerName: string
  ): Promise<{ playerId: string; sessionToken: string }> {
    const actor = await this.getActor(gameId);
    if (!actor) throw new GameNotFoundError(gameId);

    const snapshot = actor.getSnapshot();
    if (snapshot.value !== 'lobby') {
      throw new GameAlreadyStartedError(gameId);
    }

    const playerId = uuid();
    const sessionToken = generateSecureToken();

    actor.send({ type: 'PLAYER_JOINED', playerId, name: playerName });

    // Store session
    await this.persistence.saveSession(gameId, playerId, playerName, sessionToken);

    return { playerId, sessionToken };
  }

  async start(gameId: string): Promise<void> {
    const actor = await this.getActor(gameId);
    if (!actor) throw new GameNotFoundError(gameId);

    actor.send({ type: 'START_GAME' });
  }

  async makeMove(
    gameId: string,
    playerId: string,
    command: MoveCommand
  ): Promise<MoveResult> {
    const actor = await this.getActor(gameId);
    if (!actor) throw new GameNotFoundError(gameId);

    const beforeSnapshot = actor.getSnapshot();

    actor.send({ type: 'MAKE_MOVE', playerId, command });

    const afterSnapshot = actor.getSnapshot();

    // Check if move was accepted
    if (afterSnapshot.context.turnNumber === beforeSnapshot.context.turnNumber) {
      return { success: false, error: 'INVALID_MOVE' };
    }

    return {
      success: true,
      events: afterSnapshot.context.lastMoveEvents,
      newState: afterSnapshot.context
    };
  }

  async getState(gameId: string): Promise<GameState | null> {
    const actor = await this.getActor(gameId);
    return actor?.getSnapshot().context ?? null;
  }

  async listGames(filter?: { status?: string }): Promise<GameSummary[]> {
    const games: GameSummary[] = [];

    for (const [gameId, actor] of this.games) {
      const snapshot = actor.getSnapshot();
      if (!filter?.status || snapshot.value === filter.status) {
        games.push({
          gameId,
          status: snapshot.value as string,
          playerCount: snapshot.context.players.length,
          maxPlayers: snapshot.context.config.playerCount,
          createdAt: snapshot.context.createdAt
        });
      }
    }

    return games;
  }

  async recover(): Promise<number> {
    // Called on server start to restore active games
    const activeGames = await this.persistence.getActiveGames();
    let recovered = 0;

    for (const gameId of activeGames) {
      const actor = await this.persistence.restore(gameId);
      if (actor && actor.getSnapshot().value !== 'ended') {
        this.games.set(gameId, actor);
        recovered++;
      }
    }

    return recovered;
  }

  private async getActor(gameId: string): Promise<ActorRefFrom<typeof gameMachine> | null> {
    // Check memory first
    if (this.games.has(gameId)) {
      return this.games.get(gameId)!;
    }

    // Try to restore from database
    const actor = await this.persistence.restore(gameId);
    if (actor) {
      this.games.set(gameId, actor);
    }
    return actor;
  }
}
```

### Definition of Done
- [ ] Multiple games can run concurrently
- [ ] Games are isolated from each other
- [ ] Memory cleaned up when game ends
- [ ] Games restored on server restart
- [ ] List API works correctly

### Test Cases
```typescript
describe('Game Manager', () => {
  let manager: GameManager;

  beforeEach(() => {
    manager = new GameManager(mockPersistence);
  });

  test('creates game with unique ID', async () => {
    const { gameId: id1 } = await manager.create();
    const { gameId: id2 } = await manager.create();
    expect(id1).not.toBe(id2);
  });

  test('join adds player to game', async () => {
    const { gameId } = await manager.create({ playerCount: 2 });
    const { playerId } = await manager.join(gameId, 'Alice');

    const state = await manager.getState(gameId);
    expect(state?.players).toHaveLength(1);
    expect(state?.players[0].name).toBe('Alice');
  });

  test('cannot join started game', async () => {
    const { gameId } = await manager.create({ playerCount: 2 });
    await manager.join(gameId, 'Alice');
    await manager.join(gameId, 'Bob');
    await manager.start(gameId);

    await expect(manager.join(gameId, 'Charlie'))
      .rejects.toThrow(GameAlreadyStartedError);
  });

  test('makeMove returns result', async () => {
    const { gameId } = await createStartedGame(manager);

    const result = await manager.makeMove(gameId, 'p1', validMove);
    expect(result.success).toBe(true);
    expect(result.events).toBeDefined();
  });

  test('recovery restores games', async () => {
    const { gameId } = await manager.create();
    await manager.join(gameId, 'Alice');

    // Simulate restart
    const newManager = new GameManager(persistence);
    const recovered = await newManager.recover();

    expect(recovered).toBe(1);
    const state = await newManager.getState(gameId);
    expect(state?.players[0].name).toBe('Alice');
  });
});
```

---

## Phase 2 Checklist

### Prerequisites
- [ ] Phase 1 complete (all game logic)
- [ ] Database set up (Phase 0)

### Completion Criteria
- [ ] Task 2.1 complete (state machine)
- [ ] Task 2.2 complete (persistence)
- [ ] Task 2.3 complete (game manager)
- [ ] All game scenarios playable via code
- [ ] Games survive server restart
- [ ] Integration tests pass

### Handoff to Phase 3
- State machine manages game lifecycle
- Persistence layer saves/restores games
- Game manager handles multiple games
- Ready to add network layer

---

*Phase 2 Status: Not Started*
