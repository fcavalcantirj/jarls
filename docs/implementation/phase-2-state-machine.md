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
- [ ] Define all states: lobby, setup, playing (with substates), paused, ended
- [ ] Define all events (PLAYER_JOINED, START_GAME, MAKE_MOVE, etc.)
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
        │                │ MAKE_MOVE      │   │
        │  ┌─────────────▼────────────┐   │   │
        │  │     checkingGameEnd      │───┼───┘
        │  └─────────────┬────────────┘   │ [!isGameOver]
        │                │                │
        └────────────────┼────────────────┘
                         │
                    [isGameOver]
                         │
                    ┌────▼────┐
                    │  ended  │
                    └─────────┘

        ┌─────────┐
        │ paused  │ ◄── PLAYER_DISCONNECTED (from playing)
        └────┬────┘
             │ PLAYER_RECONNECTED
             └──► playing
```

### Machine Definition

```typescript
import { setup, assign, createActor } from 'xstate';
import { GameState, MoveCommand } from '@jarls/shared';

interface MachineContext extends GameState {
  disconnectedPlayers: Set<string>;
  turnTimerMs: number | null;
}

type MachineEvent =
  | { type: 'PLAYER_JOINED'; playerId: string; playerName: string; isAI?: boolean }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'START_GAME' }
  | { type: 'MAKE_MOVE'; playerId: string; command: MoveCommand }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'PLAYER_RECONNECTED'; playerId: string };

const gameMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
    input: {} as { gameId: string; config: GameConfig },
  },

  guards: {
    hasEnoughPlayers: ({ context }) => context.players.filter((p) => !p.isEliminated).length >= 2,

    isPlayersTurn: ({ context, event }) => {
      if (!('playerId' in event)) return false;
      return context.currentPlayerId === event.playerId;
    },

    isValidMove: ({ context, event }) => {
      if (event.type !== 'MAKE_MOVE') return false;
      const result = applyMove(context, event.playerId, event.command);
      return result.success;
    },

    isGameOver: ({ context }) => context.winnerId !== null,

    isTurnTimerEnabled: ({ context }) => context.turnTimerMs !== null,

    isCurrentPlayerDisconnecting: ({ context, event }) => {
      if (event.type !== 'PLAYER_DISCONNECTED') return false;
      return context.currentPlayerId === event.playerId;
    },
  },

  actions: {
    addPlayer: assign({
      players: ({ context, event }) => {
        if (event.type !== 'PLAYER_JOINED') return context.players;
        const newPlayer = {
          id: event.playerId,
          name: event.playerName,
          color: context.players.length === 0 ? '#e63946' : '#457b9d',
          isEliminated: false,
          isAI: event.isAI ?? false,
        };
        return [...context.players, newPlayer];
      },
    }),

    initializeBoard: assign(({ context }) => {
      const generated = createInitialState(
        context.players.map((p) => p.name),
        context.turnTimerMs,
        context.config.boardRadius
      );
      return {
        ...context,
        pieces: generated.pieces,
        holes: generated.holes,
        phase: 'playing',
        currentPlayerId: context.players[0].id,
      };
    }),

    applyMoveAction: assign(({ context, event }) => {
      if (event.type !== 'MAKE_MOVE') return context;
      const result = applyMove(context, event.playerId, event.command);
      return {
        ...context,
        pieces: result.newState.pieces,
        players: result.newState.players,
        currentPlayerId: result.newState.currentPlayerId,
        turnNumber: result.newState.turnNumber,
        roundNumber: result.newState.roundNumber,
        winnerId: result.newState.winnerId,
        winCondition: result.newState.winCondition,
        phase: result.newState.phase,
      };
    }),

    markPlayerDisconnected: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_DISCONNECTED') return {};
      const newDisconnected = new Set(context.disconnectedPlayers);
      newDisconnected.add(event.playerId);
      return { disconnectedPlayers: newDisconnected };
    }),

    markPlayerReconnected: assign(({ context, event }) => {
      if (event.type !== 'PLAYER_RECONNECTED') return {};
      const newDisconnected = new Set(context.disconnectedPlayers);
      newDisconnected.delete(event.playerId);
      return { disconnectedPlayers: newDisconnected };
    }),

    autoSkipTurn: assign(({ context }) => {
      // Advance turn without making a move
      return advanceTurnSkip(context);
    }),
  },

  delays: {
    turnTimer: ({ context }) => context.turnTimerMs ?? 2_147_483_647,
    disconnectTimer: () => 120_000, // 2 minutes
  },
}).createMachine({
  id: 'game',
  initial: 'lobby',
  context: ({ input }) => ({
    id: input.gameId,
    phase: 'lobby',
    config: input.config,
    players: [],
    pieces: [],
    holes: [],
    currentPlayerId: null,
    turnNumber: 0,
    roundNumber: 0,
    firstPlayerIndex: 0,
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
    moveHistory: [],
    turnTimerMs: input.config.turnTimerMs ?? null,
    disconnectedPlayers: new Set<string>(),
  }),

  states: {
    lobby: {
      on: {
        PLAYER_JOINED: {
          guard: ({ context }) => context.players.length < context.config.playerCount,
          actions: 'addPlayer',
        },
        PLAYER_LEFT: {
          actions: assign({
            players: ({ context, event }) => context.players.filter((p) => p.id !== event.playerId),
          }),
        },
        START_GAME: {
          guard: 'hasEnoughPlayers',
          target: 'setup',
        },
      },
    },

    setup: {
      entry: 'initializeBoard',
      always: { target: 'playing' },
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
            MAKE_MOVE: {
              guard: ({ context, event }) => {
                if (event.playerId !== context.currentPlayerId) return false;
                const result = applyMove(context, event.playerId, event.command);
                return result.success;
              },
              actions: 'applyMoveAction',
              target: 'checkingGameEnd',
            },
            PLAYER_DISCONNECTED: [
              {
                guard: 'isCurrentPlayerDisconnecting',
                actions: 'markPlayerDisconnected',
                target: '#game.paused',
              },
              {
                actions: 'markPlayerDisconnected',
              },
            ],
          },
        },
        checkingGameEnd: {
          always: [{ guard: 'isGameOver', target: '#game.ended' }, { target: 'awaitingMove' }],
        },
      },
    },

    paused: {
      after: {
        disconnectTimer: {
          // After 2 minutes, remain paused (future: AI takeover)
        },
      },
      on: {
        PLAYER_RECONNECTED: {
          actions: 'markPlayerReconnected',
          target: '#game.playing.awaitingMove',
        },
        PLAYER_DISCONNECTED: {
          actions: 'markPlayerDisconnected',
        },
      },
    },

    ended: {
      type: 'final',
    },
  },
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

    actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
    actor.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
    actor.send({ type: 'START_GAME' });

    expect(actor.getSnapshot().value).toEqual({ playing: 'awaitingMove' });
  });

  test('blocks START_GAME without enough players', () => {
    const actor = createActor(gameMachine, { input: defaultInput });
    actor.start();

    actor.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });
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
      command: { pieceId: 'p2_w1', destination: { q: 1, r: 0 } },
    });

    expect(actor.getSnapshot().context.turnNumber).toBe(beforeContext.turnNumber);
  });

  test('transitions to ended on throne victory', () => {
    const actor = createGameNearThrone();

    actor.send({
      type: 'MAKE_MOVE',
      playerId: 'p1',
      command: { pieceId: 'p1_j', destination: THRONE },
    });

    expect(actor.getSnapshot().value).toBe('ended');
    expect(actor.getSnapshot().context.winnerId).toBe('p1');
  });

  test('turn timer advances turn', async () => {
    const actor = createStartedGame({ turnTimerMs: 1000 });

    await new Promise((r) => setTimeout(r, 1100));

    expect(actor.getSnapshot().context.currentPlayerId).not.toBe('p1');
  });

  test('pauses game on current player disconnect', () => {
    const actor = createStartedGame();

    actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });

    expect(actor.getSnapshot().value).toBe('paused');
  });

  test('resumes game on player reconnect', () => {
    const actor = createStartedGame();

    actor.send({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
    actor.send({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });

    expect(actor.getSnapshot().value).toEqual({ playing: 'awaitingMove' });
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
      const result = await client.query(
        `
        UPDATE game_snapshots
        SET state_snapshot = $2, version = $3, updated_at = now(), status = $4
        WHERE game_id = $1 AND version = $3 - 1
        RETURNING *
      `,
        [gameId, JSON.stringify(snapshot), version, snapshot.value]
      );

      if (result.rowCount === 0) {
        // Either doesn't exist or version mismatch
        const exists = await client.query('SELECT version FROM game_snapshots WHERE game_id = $1', [
          gameId,
        ]);

        if (exists.rowCount === 0) {
          // First save
          await client.query(
            `
            INSERT INTO game_snapshots (game_id, state_snapshot, version, status)
            VALUES ($1, $2, $3, $4)
          `,
            [gameId, JSON.stringify(snapshot), version, snapshot.value]
          );
        } else {
          throw new Error(
            `Version conflict: expected ${exists.rows[0].version + 1}, got ${version}`
          );
        }
      }

      // Append event to log
      if (event) {
        await client.query(
          `
          INSERT INTO game_events (game_id, event_type, payload, version)
          VALUES ($1, $2, $3, $4)
        `,
          [gameId, event.type, JSON.stringify(event), version]
        );
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
  test('save and restore game', async () => {
    const actor1 = createActor(gameMachine, { input: testInput });
    actor1.start();
    actor1.send({ type: 'PLAYER_JOINED', playerId: 'p1', playerName: 'Alice' });

    await persistence.save('test-game-1', actor1);

    const actor2 = await persistence.restore('test-game-1');
    expect(actor2?.getSnapshot().context.players).toHaveLength(1);
    expect(actor2?.getSnapshot().context.players[0].name).toBe('Alice');
  });

  test('handles concurrent save conflict', async () => {
    const actor1 = await persistence.restore('test-game-1');
    const actor2 = await persistence.restore('test-game-1');

    actor1?.send({ type: 'PLAYER_JOINED', playerId: 'p2', playerName: 'Bob' });
    actor2?.send({ type: 'PLAYER_JOINED', playerId: 'p3', playerName: 'Charlie' });

    await persistence.save('test-game-1', actor1!);

    await expect(persistence.save('test-game-1', actor2!)).rejects.toThrow('Version conflict');
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

### Definition of Done

- [ ] Multiple games can run concurrently
- [ ] Games are isolated from each other
- [ ] Memory cleaned up when game ends
- [ ] Games restored on server restart
- [ ] List API works correctly

### Test Cases

```typescript
describe('Game Manager', () => {
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

    await expect(manager.join(gameId, 'Charlie')).rejects.toThrow(GameAlreadyStartedError);
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

_Phase 2 Status: Complete_
_Updated: 2026-02-01_
_Removed: Starvation state_
