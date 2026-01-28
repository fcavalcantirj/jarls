# WebSocket API Documentation

Jarls uses [Socket.IO](https://socket.io/) for real-time game communication. All game actions (joining, playing turns, starvation choices) flow through WebSocket events after initial REST API authentication.

## Connection

### Endpoint

```
ws://localhost:3000
```

### Configuration

- **CORS origins**: `http://localhost:5173` (Vite dev server)
- **Connection State Recovery**: 2-minute window for reconnection
- **Transport**: WebSocket with polling fallback (Socket.IO default)

### Authentication Flow

1. Call `POST /api/games/:id/join` to get a `sessionToken` (see [API docs](./API.md))
2. Connect to Socket.IO with the token:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  autoConnect: false,
});

socket.auth = { token: sessionToken };
socket.connect();
```

3. After connecting, emit `joinGame` with the session token to enter a game room

---

## Client-to-Server Events

All client events use Socket.IO acknowledgement callbacks for immediate response.

### `joinGame`

Joins the player to a game room after session validation.

**Payload:**

```typescript
{
  gameId: string; // Game ID to join
  sessionToken: string; // Token from POST /api/games/:id/join
}
```

**Response (callback):**

```typescript
{
  success: boolean;
  error?: string;         // Error message if success is false
  gameState?: GameState;  // Current game state if successful
  playerId?: string;      // Assigned player ID
}
```

**Side effects:** Broadcasts `playerJoined` to other players in the room.

---

### `startGame`

Starts the game (host only). Transitions game from lobby to playing phase.

**Payload:**

```typescript
{
  gameId: string;
}
```

**Response (callback):**

```typescript
{
  success: boolean;
  error?: string;
}
```

**Side effects:** Broadcasts `gameState` to all players in the room with the initialized board.

---

### `playTurn`

Executes a move command for the current player.

**Payload:**

```typescript
{
  gameId: string;
  command: {
    pieceId: string; // ID of the piece to move
    destination: {
      q: number;
      r: number;
    } // Target hex (axial coordinates)
  }
}
```

**Response (callback):**

```typescript
{
  success: boolean;
  error?: string;
}
```

**Side effects:**

- Broadcasts `turnPlayed` to all players with move events and new state
- If game ended: broadcasts `gameEnded`
- If starvation triggered: broadcasts `starvationRequired`

---

### `starvationChoice`

Submits a warrior sacrifice choice during starvation phase.

**Payload:**

```typescript
{
  gameId: string;
  pieceId: string; // ID of the warrior to sacrifice
}
```

**Response (callback):**

```typescript
{
  success: boolean;
  error?: string;
}
```

**Side effects:**

- If all choices received: broadcasts `gameState` with updated state
- If game ended from starvation: broadcasts `gameEnded`

---

## Server-to-Client Events

### `gameState`

Sends complete game state to clients.

**Emitted when:** Game starts, starvation resolves, player reconnects.

**Payload:**

```typescript
{
  id: string;
  phase: 'lobby' | 'setup' | 'playing' | 'starvation' | 'ended';
  config: GameConfig;
  players: Player[];
  pieces: Piece[];
  currentPlayerId: string | null;
  turnNumber: number;
  roundNumber: number;
  firstPlayerIndex: number;
  roundsSinceElimination: number;
  winnerId: string | null;
  winCondition: 'throne' | 'lastStanding' | null;
}
```

---

### `turnPlayed`

Notifies all players of a completed turn with animation data.

**Emitted when:** A move is successfully executed.

**Payload:**

```typescript
{
  newState: GameState;
  events: GameEvent[];       // Ordered list of events for animation
  validMoves?: ValidMove[];  // Optional pre-computed valid moves
}
```

**GameEvent types:**

| Event Type             | Fields                                    | Description                   |
| ---------------------- | ----------------------------------------- | ----------------------------- |
| `MOVE`                 | `pieceId, from, to, hasMomentum`          | Piece moved to a new hex      |
| `PUSH`                 | `pieceId, from, to, pushDirection, depth` | Piece pushed by combat        |
| `ELIMINATED`           | `pieceId, playerId, position, cause`      | Piece removed from board      |
| `TURN_ENDED`           | `playerId, nextPlayerId, turnNumber`      | Turn completed                |
| `GAME_ENDED`           | `winnerId, winCondition`                  | Game concluded                |
| `STARVATION_TRIGGERED` | `round, candidates`                       | Starvation phase started      |
| `STARVATION_RESOLVED`  | `sacrifices`                              | Starvation phase ended        |
| `JARL_STARVED`         | `pieceId, playerId, position`             | Jarl eliminated by starvation |
| `TURN_SKIPPED`         | `playerId, nextPlayerId, turnNumber`      | Turn timed out                |

---

### `gameEnded`

Notifies all players that the game has ended.

**Emitted when:** A victory condition is met (throne capture or last standing).

**Payload:**

```typescript
{
  winnerId: string;
  winCondition: 'throne' | 'lastStanding';
  finalState: GameState;
}
```

---

### `playerJoined`

Notifies other players that a new player joined the game.

**Emitted when:** A player successfully joins a game room.

**Payload:**

```typescript
{
  playerId: string;
  playerName: string;
  gameState: GameState;
}
```

---

### `playerLeft`

Notifies remaining players that someone disconnected.

**Emitted when:** A player's socket disconnects.

**Payload:**

```typescript
{
  playerId: string;
  gameState: GameState;
}
```

---

### `playerReconnected`

Notifies remaining players that a disconnected player returned.

**Emitted when:** A player reconnects within the 2-minute recovery window.

**Payload:**

```typescript
{
  playerId: string;
  playerName: string;
  gameState: GameState;
}
```

---

### `starvationRequired`

Requests players to choose a warrior to sacrifice.

**Emitted when:** Starvation triggers after a turn (10+ rounds without elimination).

**Payload:**

```typescript
{
  candidates: Array<{
    playerId: string;
    candidates: Piece[]; // Warriors eligible for sacrifice
    maxDistance: number; // Distance from throne of furthest warrior
  }>;
  timeoutMs: number; // Auto-select timeout in milliseconds
}
```

---

### `error`

General error broadcast.

**Payload:**

```typescript
{
  code: string;
  message: string;
}
```

---

## Connection Lifecycle

```
Client                              Server
  |                                   |
  |--- connect (auth: {token}) ------>|
  |                                   |
  |--- joinGame ------------------->  |
  |<-- callback (gameState) --------- |
  |<-- playerJoined (to others) ----- |
  |                                   |
  |--- startGame ------------------>  |
  |<-- callback (success) ----------- |
  |<-- gameState (broadcast) -------- |
  |                                   |
  |--- playTurn ------------------->  |
  |<-- callback (success) ----------- |
  |<-- turnPlayed (broadcast) ------- |
  |                                   |
  |    [if game ended]                |
  |<-- gameEnded (broadcast) -------- |
  |                                   |
  |    [if starvation triggered]      |
  |<-- starvationRequired ----------- |
  |--- starvationChoice ----------->  |
  |<-- callback (success) ----------- |
  |<-- gameState (broadcast) -------- |
  |                                   |
  |    [on disconnect]                |
  |<-- playerLeft (to others) ------- |
  |                                   |
  |    [on reconnect within 2 min]    |
  |<-- gameState (to reconnector) --- |
  |<-- playerReconnected (to others)  |
```

---

## Error Handling

All client-to-server events return errors via the acknowledgement callback:

```typescript
socket.emit('playTurn', payload, (response) => {
  if (!response.success) {
    console.error(response.error);
    // e.g. "Not your turn", "Invalid move", "Game not found"
  }
});
```

Common error scenarios:

- **Not joined**: Player hasn't called `joinGame` yet
- **Invalid session**: Session token expired or invalid
- **Not your turn**: Attempted move on another player's turn
- **Invalid move**: Move violates game rules
- **Game not found**: Game ID doesn't exist
