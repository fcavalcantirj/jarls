# Phase 3: Network Layer

## Overview

Implement REST API and WebSocket communication for multiplayer gameplay.

**Prerequisites:** Phase 2 complete
**Estimated Effort:** 3-4 days
**Package:** `@jarls/server`

---

## Task 3.1: REST API Endpoints

### Description

Implement REST API for game management operations.

### Work Items

- [ ] Set up Express with TypeScript
- [ ] Implement input validation middleware (Zod)
- [ ] Implement error handling middleware
- [ ] Implement `POST /api/games` - Create game
- [ ] Implement `GET /api/games` - List joinable games
- [ ] Implement `GET /api/games/:id` - Get game state
- [ ] Implement `POST /api/games/:id/join` - Join game
- [ ] Implement `POST /api/games/:id/start` - Start game
- [ ] Implement `GET /api/games/:id/valid-moves/:pieceId` - Get valid moves
- [ ] Generate OpenAPI documentation

### API Specification

#### Create Game

```http
POST /api/games
Content-Type: application/json

{
  "playerCount": 2,
  "turnTimerSeconds": 60,
  "isPrivate": false
}

Response 201:
{
  "gameId": "uuid",
  "joinCode": "ABC123"
}
```

#### List Games

```http
GET /api/games?status=lobby&limit=10

Response 200:
{
  "games": [
    {
      "gameId": "uuid",
      "playerCount": 2,
      "currentPlayers": 1,
      "createdAt": "2026-01-25T12:00:00Z"
    }
  ]
}
```

#### Get Game State

```http
GET /api/games/:id
Authorization: Bearer <sessionToken>

Response 200:
{
  "gameId": "uuid",
  "phase": "playing",
  "players": [...],
  "pieces": [...],
  "currentPlayerIndex": 0,
  "turnNumber": 5
}
```

#### Join Game

```http
POST /api/games/:id/join
Content-Type: application/json

{
  "playerName": "Alice"
}

Response 200:
{
  "playerId": "uuid",
  "sessionToken": "secure-token",
  "gameState": {...}
}
```

#### Get Valid Moves

```http
GET /api/games/:id/valid-moves/:pieceId
Authorization: Bearer <sessionToken>

Response 200:
{
  "moves": [
    {
      "to": { "q": 1, "r": 0 },
      "type": "move",
      "hasMomentum": false
    },
    {
      "to": { "q": 2, "r": -1 },
      "type": "attack",
      "hasMomentum": true,
      "combat": {
        "attack": 2,
        "defense": 1,
        "outcome": "push"
      }
    }
  ]
}
```

### Express Setup

```typescript
import express from 'express';
import { z } from 'zod';
import { GameManager } from './game-manager';

const app = express();
app.use(express.json());

// Validation schemas
const CreateGameSchema = z.object({
  playerCount: z.number().min(2).max(6).default(2),
  turnTimerSeconds: z.number().min(10).max(300).nullable().default(60),
  isPrivate: z.boolean().default(false),
});

const JoinGameSchema = z.object({
  playerName: z.string().min(1).max(20),
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof GameNotFoundError) {
    return res.status(404).json({ error: 'GAME_NOT_FOUND', message: err.message });
  }
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

// Routes
app.post('/api/games', async (req, res, next) => {
  try {
    const input = CreateGameSchema.parse(req.body);
    const result = await gameManager.create(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/api/games', async (req, res, next) => {
  try {
    const games = await gameManager.listGames({ status: 'lobby' });
    res.json({ games });
  } catch (err) {
    next(err);
  }
});

app.get('/api/games/:id', authenticateSession, async (req, res, next) => {
  try {
    const state = await gameManager.getState(req.params.id);
    if (!state) throw new GameNotFoundError(req.params.id);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

app.post('/api/games/:id/join', async (req, res, next) => {
  try {
    const { playerName } = JoinGameSchema.parse(req.body);
    const result = await gameManager.join(req.params.id, playerName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get('/api/games/:id/valid-moves/:pieceId', authenticateSession, async (req, res, next) => {
  try {
    const state = await gameManager.getState(req.params.id);
    if (!state) throw new GameNotFoundError(req.params.id);

    const moves = getValidMoves(state, req.session.playerId, req.params.pieceId);
    res.json({ moves });
  } catch (err) {
    next(err);
  }
});
```

### Definition of Done

- [ ] All endpoints implemented
- [ ] Input validation on all endpoints
- [ ] Consistent error response format
- [ ] Authentication middleware works
- [ ] OpenAPI spec generated

### Test Cases

```typescript
describe('REST API', () => {
  test('POST /api/games creates game', async () => {
    const res = await request(app).post('/api/games').send({ playerCount: 2 });

    expect(res.status).toBe(201);
    expect(res.body.gameId).toBeDefined();
  });

  test('POST /api/games validates input', async () => {
    const res = await request(app).post('/api/games').send({ playerCount: 10 }); // Invalid

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('GET /api/games lists lobby games', async () => {
    await createGame();
    await createGame();

    const res = await request(app).get('/api/games');

    expect(res.status).toBe(200);
    expect(res.body.games.length).toBeGreaterThanOrEqual(2);
  });

  test('POST /api/games/:id/join returns session', async () => {
    const { gameId } = await createGame();

    const res = await request(app).post(`/api/games/${gameId}/join`).send({ playerName: 'Alice' });

    expect(res.status).toBe(200);
    expect(res.body.playerId).toBeDefined();
    expect(res.body.sessionToken).toBeDefined();
  });

  test('GET /api/games/:id requires auth', async () => {
    const { gameId } = await createGame();

    const res = await request(app).get(`/api/games/${gameId}`);

    expect(res.status).toBe(401);
  });

  test('GET /api/games/:id/valid-moves returns moves', async () => {
    const { gameId, sessionToken, playerId } = await createJoinedGame();
    await startGame(gameId);

    const res = await request(app)
      .get(`/api/games/${gameId}/valid-moves/p1_w1`)
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.moves).toBeInstanceOf(Array);
  });
});
```

---

## Task 3.2: Socket.IO Integration

### Description

Implement real-time WebSocket communication for game events.

### Work Items

- [ ] Set up Socket.IO server with Express
- [ ] Configure Connection State Recovery
- [ ] Implement room management (one game = one room)
- [ ] Implement `joinGame` event
- [ ] Implement `playTurn` event with acknowledgement
- [ ] Implement broadcast events (turnPlayed, playerJoined, etc.)
- [ ] Implement spectator support
- [ ] Handle disconnection/reconnection

### Socket.IO Setup

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';

// Type-safe events
interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  turnPlayed: (data: { playerId: string; events: GameEvent[] }) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  gameStarted: (state: GameState) => void;
  gameEnded: (data: { winner: string; condition: string }) => void;
  starvationTriggered: (data: StarvationChoice[]) => void;
  turnTimeout: (data: { playerId: string }) => void;
  error: (error: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
  joinGame: (
    data: { gameId: string; sessionToken: string },
    callback: (response: { success: boolean; state?: GameState; error?: string }) => void
  ) => void;

  playTurn: (
    data: { command: MoveCommand },
    callback: (response: { success: boolean; events?: GameEvent[]; error?: string }) => void
  ) => void;

  startGame: (callback: (response: { success: boolean; error?: string }) => void) => void;

  starvationChoice: (
    data: { pieceId: string },
    callback: (response: { success: boolean }) => void
  ) => void;

  spectate: (
    data: { gameId: string },
    callback: (response: { success: boolean; state?: GameState }) => void
  ) => void;
}

interface SocketData {
  gameId?: string;
  playerId?: string;
  sessionToken?: string;
  isSpectator?: boolean;
}

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// Connection handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle reconnection
  if (socket.recovered) {
    console.log(`Socket recovered: ${socket.id}, game: ${socket.data.gameId}`);
    return;
  }

  // Join game room
  socket.on('joinGame', async ({ gameId, sessionToken }, callback) => {
    try {
      const session = await validateSession(sessionToken, gameId);
      if (!session) {
        return callback({ success: false, error: 'INVALID_SESSION' });
      }

      socket.data.gameId = gameId;
      socket.data.playerId = session.playerId;
      socket.data.sessionToken = sessionToken;

      await socket.join(`game:${gameId}`);

      const state = await gameManager.getState(gameId);

      // Notify others
      socket.to(`game:${gameId}`).emit('playerJoined', {
        id: session.playerId,
        name: session.playerName,
      });

      callback({ success: true, state });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Play turn
  socket.on('playTurn', async ({ command }, callback) => {
    const { gameId, playerId } = socket.data;
    if (!gameId || !playerId) {
      return callback({ success: false, error: 'NOT_IN_GAME' });
    }

    try {
      const result = await gameManager.makeMove(gameId, playerId, command);

      if (!result.success) {
        return callback({ success: false, error: result.error });
      }

      // Broadcast to all in room (including sender for confirmation)
      io.to(`game:${gameId}`).emit('turnPlayed', {
        playerId,
        events: result.events,
      });

      // Check for game end
      if (result.newState.winner) {
        io.to(`game:${gameId}`).emit('gameEnded', {
          winner: result.newState.winner,
          condition: result.newState.winCondition,
        });
      }

      callback({ success: true, events: result.events });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Start game
  socket.on('startGame', async (callback) => {
    const { gameId, playerId } = socket.data;
    if (!gameId) {
      return callback({ success: false, error: 'NOT_IN_GAME' });
    }

    try {
      await gameManager.start(gameId);
      const state = await gameManager.getState(gameId);

      io.to(`game:${gameId}`).emit('gameStarted', state);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Spectate
  socket.on('spectate', async ({ gameId }, callback) => {
    try {
      const state = await gameManager.getState(gameId);
      if (!state) {
        return callback({ success: false, error: 'GAME_NOT_FOUND' });
      }

      socket.data.gameId = gameId;
      socket.data.isSpectator = true;

      await socket.join(`game:${gameId}`);
      callback({ success: true, state });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Handle disconnect
  socket.on('disconnecting', () => {
    const { gameId, playerId, isSpectator } = socket.data;
    if (gameId && playerId && !isSpectator) {
      socket.to(`game:${gameId}`).emit('playerLeft', playerId);
    }
  });
});

// Subscribe to game manager events for broadcasting
gameManager.on('turnTimeout', ({ gameId, playerId }) => {
  io.to(`game:${gameId}`).emit('turnTimeout', { playerId });
});

gameManager.on('starvation', ({ gameId, choices }) => {
  io.to(`game:${gameId}`).emit('starvationTriggered', choices);
});
```

### Definition of Done

- [ ] Players receive real-time updates
- [ ] Disconnected players can reconnect (2 min window)
- [ ] Move acknowledgements work correctly
- [ ] Spectators can watch without affecting game
- [ ] All game events broadcast to room

### Test Cases

```typescript
describe('Socket.IO', () => {
  let io: Server;
  let clientSocket: Socket;

  beforeAll((done) => {
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = ioClient(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  test('joinGame with valid session', (done) => {
    clientSocket.emit('joinGame', { gameId, sessionToken }, (response) => {
      expect(response.success).toBe(true);
      expect(response.state).toBeDefined();
      done();
    });
  });

  test('joinGame with invalid session fails', (done) => {
    clientSocket.emit('joinGame', { gameId, sessionToken: 'invalid' }, (response) => {
      expect(response.success).toBe(false);
      expect(response.error).toBe('INVALID_SESSION');
      done();
    });
  });

  test('playTurn broadcasts to room', (done) => {
    const otherClient = createOtherClient();

    otherClient.on('turnPlayed', (data) => {
      expect(data.playerId).toBe(playerId);
      expect(data.events).toBeInstanceOf(Array);
      done();
    });

    clientSocket.emit('playTurn', { command: validMove }, (response) => {
      expect(response.success).toBe(true);
    });
  });

  test('spectator receives updates', (done) => {
    const spectator = createSpectatorClient();

    spectator.emit('spectate', { gameId }, (response) => {
      expect(response.success).toBe(true);
    });

    spectator.on('turnPlayed', (data) => {
      expect(data).toBeDefined();
      done();
    });

    // Trigger a move
    clientSocket.emit('playTurn', { command: validMove }, () => {});
  });

  test('reconnection restores state', async () => {
    clientSocket.disconnect();

    await new Promise((r) => setTimeout(r, 100));

    clientSocket.connect();

    await new Promise((r) => setTimeout(r, 100));

    expect(clientSocket.recovered).toBe(true);
  });
});
```

---

## Task 3.3: Session Management

### Description

Implement secure session management for player authentication.

### Work Items

- [ ] Generate cryptographically secure session tokens
- [ ] Store sessions in Redis (fast lookup)
- [ ] Implement session validation middleware
- [ ] Handle session expiration
- [ ] Support session restoration on reconnect
- [ ] Clean up expired sessions

### Session Service

```typescript
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

interface Session {
  gameId: string;
  playerId: string;
  playerName: string;
  createdAt: Date;
  expiresAt: Date;
}

export class SessionService {
  private redis: Redis;
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async create(gameId: string, playerId: string, playerName: string): Promise<string> {
    const token = this.generateToken();
    const session: Session = {
      gameId,
      playerId,
      playerName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000),
    };

    await this.redis.setex(`session:${token}`, this.SESSION_TTL, JSON.stringify(session));

    // Also store reverse lookup
    await this.redis.setex(`player_session:${gameId}:${playerId}`, this.SESSION_TTL, token);

    return token;
  }

  async validate(token: string, gameId?: string): Promise<Session | null> {
    const data = await this.redis.get(`session:${token}`);
    if (!data) return null;

    const session: Session = JSON.parse(data);

    // Optionally verify game ID matches
    if (gameId && session.gameId !== gameId) {
      return null;
    }

    return session;
  }

  async invalidate(token: string): Promise<void> {
    const session = await this.validate(token);
    if (session) {
      await this.redis.del(`session:${token}`);
      await this.redis.del(`player_session:${session.gameId}:${session.playerId}`);
    }
  }

  async getByPlayer(gameId: string, playerId: string): Promise<string | null> {
    return this.redis.get(`player_session:${gameId}:${playerId}`);
  }

  async extend(token: string): Promise<void> {
    const session = await this.validate(token);
    if (session) {
      session.expiresAt = new Date(Date.now() + this.SESSION_TTL * 1000);
      await this.redis.setex(`session:${token}`, this.SESSION_TTL, JSON.stringify(session));
    }
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }
}

// Middleware
export function authenticateSession(sessionService: SessionService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing session token' });
    }

    const token = authHeader.slice(7);
    const session = await sessionService.validate(token, req.params.id);

    if (!session) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session' });
    }

    req.session = session;
    next();
  };
}
```

### Definition of Done

- [ ] Session tokens are cryptographically secure
- [ ] Sessions expire appropriately
- [ ] Session validation is fast (<5ms)
- [ ] Multiple connections share session
- [ ] Cleanup runs periodically

### Test Cases

```typescript
describe('Session Management', () => {
  let sessionService: SessionService;

  beforeAll(() => {
    sessionService = new SessionService(process.env.REDIS_URL!);
  });

  test('creates secure token', async () => {
    const token = await sessionService.create('game1', 'player1', 'Alice');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  test('validates valid session', async () => {
    const token = await sessionService.create('game1', 'player1', 'Alice');
    const session = await sessionService.validate(token);

    expect(session).not.toBeNull();
    expect(session?.playerId).toBe('player1');
  });

  test('rejects invalid token', async () => {
    const session = await sessionService.validate('invalid-token');
    expect(session).toBeNull();
  });

  test('validates game ID match', async () => {
    const token = await sessionService.create('game1', 'player1', 'Alice');

    const valid = await sessionService.validate(token, 'game1');
    const invalid = await sessionService.validate(token, 'game2');

    expect(valid).not.toBeNull();
    expect(invalid).toBeNull();
  });

  test('invalidates session', async () => {
    const token = await sessionService.create('game1', 'player1', 'Alice');
    await sessionService.invalidate(token);

    const session = await sessionService.validate(token);
    expect(session).toBeNull();
  });

  test('performance under 5ms', async () => {
    const token = await sessionService.create('game1', 'player1', 'Alice');

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await sessionService.validate(token);
    }
    const elapsed = Date.now() - start;

    expect(elapsed / 100).toBeLessThan(5);
  });
});
```

---

## Phase 3 Checklist

### Prerequisites

- [ ] Phase 2 complete (state machine + persistence)
- [ ] Redis running

### Completion Criteria

- [ ] Task 3.1 complete (REST API)
- [ ] Task 3.2 complete (Socket.IO)
- [ ] Task 3.3 complete (sessions)
- [ ] Two players can play complete game via network
- [ ] Spectators can watch
- [ ] Disconnection/reconnection works

### Handoff to Phase 4

- Full network API available
- Real-time events working
- Session management secure
- Ready to add AI opponent

---

_Phase 3 Status: Not Started_
