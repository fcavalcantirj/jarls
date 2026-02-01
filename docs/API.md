# Jarls REST API Documentation

Base URL: `http://localhost:3000` (development)

## Authentication

Authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <session-token>
```

Session tokens are 64-character hex strings obtained from the join endpoint. Tokens expire after 24 hours and are stored in Redis.

---

## Endpoints

### GET /health

Server health check. No authentication required.

**Response** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-01-27T12:00:00.000Z"
}
```

---

### POST /api/games

Create a new game. No authentication required.

**Request Body**

```json
{
  "playerCount": 2,
  "turnTimerMs": null
}
```

| Field       | Type           | Required | Default | Description                            |
| ----------- | -------------- | -------- | ------- | -------------------------------------- |
| playerCount | number         | No       | 2       | Number of players (2-6)                |
| turnTimerMs | number \| null | No       | null    | Turn timer in ms, or null for no timer |

**Response** `201 Created`

```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors**

| Status | Code             | Cause                                                               |
| ------ | ---------------- | ------------------------------------------------------------------- |
| 400    | VALIDATION_ERROR | playerCount not in 2-6 range, or turnTimerMs not a positive integer |

---

### GET /api/games

List all games, optionally filtered by status. No authentication required.

**Query Parameters**

| Param  | Type   | Required | Description                                                          |
| ------ | ------ | -------- | -------------------------------------------------------------------- |
| status | string | No       | Filter by game phase: `lobby`, `setup`, `playing`, `paused`, `ended` |

**Response** `200 OK`

```json
{
  "games": [
    {
      "id": "550e8400-...",
      "phase": "lobby",
      "config": { "playerCount": 2, "boardRadius": 3 },
      "players": [{ "id": "p1-id", "name": "Alice", "color": "#FF0000", "isEliminated": false }],
      "pieces": []
    }
  ]
}
```

---

### POST /api/games/:id/join

Join a game and receive a session token. No authentication required.

**Path Parameters**

| Param | Type   | Description |
| ----- | ------ | ----------- |
| id    | string | Game ID     |

**Request Body**

```json
{
  "playerName": "Alice"
}
```

| Field      | Type   | Required | Description                           |
| ---------- | ------ | -------- | ------------------------------------- |
| playerName | string | Yes      | Player display name (1-30 characters) |

**Response** `200 OK`

```json
{
  "sessionToken": "a1b2c3d4...64-char-hex-string",
  "playerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors**

| Status | Code             | Cause                                     |
| ------ | ---------------- | ----------------------------------------- |
| 400    | VALIDATION_ERROR | playerName empty or exceeds 30 characters |
| 404    | GAME_NOT_FOUND   | Game ID does not exist                    |

---

### GET /api/games/:id

Get current game state. **Requires authentication.**

**Path Parameters**

| Param | Type   | Description |
| ----- | ------ | ----------- |
| id    | string | Game ID     |

**Response** `200 OK`

```json
{
  "state": {
    "id": "game-id",
    "phase": "playing",
    "config": {
      "playerCount": 2,
      "boardRadius": 3,
      "warriorsPerPlayer": 5
    },
    "players": [
      {
        "id": "player-id",
        "name": "Alice",
        "color": "#FF0000",
        "isEliminated": false
      }
    ],
    "pieces": [
      {
        "id": "piece-id",
        "type": "jarl",
        "playerId": "player-id",
        "position": { "q": 0, "r": -3 }
      }
    ],
    "holes": [{ "q": 1, "r": 1 }],
    "currentPlayerId": "player-id",
    "turnNumber": 5,
    "roundNumber": 1,
    "firstPlayerIndex": 0,
    "roundsSinceElimination": 0,
    "winnerId": null,
    "winCondition": null
  }
}
```

**Errors**

| Status | Code           | Cause                                      |
| ------ | -------------- | ------------------------------------------ |
| 401    | UNAUTHORIZED   | Missing, invalid, or expired session token |
| 404    | GAME_NOT_FOUND | Game ID does not exist                     |

---

### POST /api/games/:id/start

Start the game. **Requires authentication.** Only the host (first player to join) can start.

**Path Parameters**

| Param | Type   | Description |
| ----- | ------ | ----------- |
| id    | string | Game ID     |

**Request Body**

```json
{}
```

**Response** `200 OK`

```json
{
  "success": true
}
```

**Errors**

| Status | Code           | Cause                                            |
| ------ | -------------- | ------------------------------------------------ |
| 401    | UNAUTHORIZED   | Missing/invalid token, or caller is not the host |
| 404    | GAME_NOT_FOUND | Game ID does not exist                           |

---

### GET /api/games/:id/valid-moves/:pieceId

Get all valid moves for a specific piece. **Requires authentication.**

**Path Parameters**

| Param   | Type   | Description              |
| ------- | ------ | ------------------------ |
| id      | string | Game ID                  |
| pieceId | string | ID of the piece to query |

**Response** `200 OK`

```json
{
  "moves": [
    {
      "destination": { "q": 1, "r": 0 },
      "moveType": "move",
      "hasMomentum": false,
      "combatPreview": null
    },
    {
      "destination": { "q": 1, "r": 1 },
      "moveType": "attack",
      "hasMomentum": true,
      "combatPreview": {
        "attackerId": "piece-id",
        "defenderId": "opponent-piece-id",
        "attack": {
          "baseStrength": 1,
          "momentum": 1,
          "support": 2,
          "total": 4
        },
        "defense": {
          "baseStrength": 1,
          "momentum": 0,
          "support": 1,
          "total": 2
        },
        "outcome": "push",
        "pushDirection": 3
      }
    }
  ]
}
```

**Errors**

| Status | Code           | Cause                            |
| ------ | -------------- | -------------------------------- |
| 401    | UNAUTHORIZED   | Missing or invalid session token |
| 404    | GAME_NOT_FOUND | Game ID does not exist           |

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

### Error Codes

| Code             | HTTP Status | Description                                |
| ---------------- | ----------- | ------------------------------------------ |
| VALIDATION_ERROR | 400         | Request body failed Zod validation         |
| INVALID_MOVE     | 400         | Move is not legal per game rules           |
| NOT_YOUR_TURN    | 400         | Player attempted a move out of turn        |
| UNAUTHORIZED     | 401         | Missing, invalid, or expired session token |
| GAME_NOT_FOUND   | 404         | No game exists with the given ID           |
| INTERNAL_ERROR   | 500         | Unexpected server error                    |

Stack traces are included in development mode only.

---

## Data Types Reference

### GameState

```typescript
{
  id: string;
  phase: "lobby" | "setup" | "playing" | "paused" | "ended";
  config: GameConfig;
  players: Player[];
  pieces: Piece[];
  holes: AxialCoord[];
  currentPlayerId: string | null;
  turnNumber: number;
  roundNumber: number;
  firstPlayerIndex: number;
  roundsSinceElimination: number;
  winnerId: string | null;
  winCondition: "throne" | "lastStanding" | null;
}
```

### Player

```typescript
{
  id: string;
  name: string;
  color: string;
  isEliminated: boolean;
  isAI: boolean;
}
```

### Piece

```typescript
{
  id: string;
  type: 'jarl' | 'warrior';
  playerId: string;
  position: {
    q: number;
    r: number;
  } // Axial hex coordinates
}
```

### ValidMove

```typescript
{
  destination: {
    q: number;
    r: number;
  }
  moveType: 'move' | 'attack';
  hasMomentum: boolean;
  combatPreview: CombatPreview | null;
}
```

### CombatPreview

```typescript
{
  attackerId: string;
  defenderId: string;
  attack: {
    baseStrength: number;
    momentum: number;
    support: number;
    total: number;
  }
  defense: {
    baseStrength: number;
    momentum: number;
    support: number;
    total: number;
  }
  outcome: 'push' | 'blocked';
  pushDirection: number; // HexDirection (0-5)
}
```

---

_Updated: 2026-02-01_
_Removed: Starvation phase, Shield pieces_
