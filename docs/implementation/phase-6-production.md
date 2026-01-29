# Phase 6: Polish & Production

## Overview

Finalize the game for production with error handling, performance optimization, deployment, and documentation.

**Prerequisites:** Phase 5 complete
**Estimated Effort:** 3-5 days
**Packages:** All

---

## Task 6.1: Error Handling

### Description

Implement comprehensive error handling across the application.

### Work Items

- [ ] Server-side error middleware
- [ ] Client-side error boundaries
- [ ] Connection error handling
- [ ] Reconnection retry logic
- [ ] Graceful degradation
- [ ] User-friendly error messages
- [ ] Error logging/reporting (optional: Sentry)

### Server Error Handling

```typescript
// Error types
export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export class GameNotFoundError extends GameError {
  constructor(gameId: string) {
    super('GAME_NOT_FOUND', `Game ${gameId} not found`, 404);
  }
}

export class InvalidMoveError extends GameError {
  constructor(reason: string) {
    super('INVALID_MOVE', reason, 400);
  }
}

export class NotYourTurnError extends GameError {
  constructor() {
    super('NOT_YOUR_TURN', 'It is not your turn', 403);
  }
}

// Express error middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known errors
  if (err instanceof GameError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: err.errors,
    });
  }

  // Unknown errors
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
```

### Client Error Handling

```typescript
// React error boundary
class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Game error:', error, errorInfo);
    // Report to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Socket reconnection
function useSocketConnection(url: string) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const retryCount = useRef(0);

  useEffect(() => {
    const socket = io(url, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      setStatus('connected');
      retryCount.current = 0;
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('reconnecting', () => {
      setStatus('reconnecting');
      retryCount.current++;
    });

    socket.on('reconnect_failed', () => {
      setStatus('disconnected');
      // Show "connection lost" UI
    });

    socketRef.current = socket;

    return () => {
      socket.close();
    };
  }, [url]);

  return { socket: socketRef.current, status };
}
```

### Definition of Done

- [ ] No unhandled exceptions crash the server
- [ ] No unhandled rejections crash the server
- [ ] Client shows friendly error messages
- [ ] Auto-retry on transient failures
- [ ] Errors logged with context

### Test Cases

```typescript
describe('Error Handling', () => {
  test('returns 404 for unknown game', async () => {
    const res = await request(app).get('/api/games/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('GAME_NOT_FOUND');
  });

  test('returns 400 for invalid input', async () => {
    const res = await request(app).post('/api/games').send({ playerCount: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('client reconnects after disconnect', async () => {
    const { socket, status } = renderHook(() => useSocketConnection(url));

    // Simulate disconnect
    socket.disconnect();
    expect(status).toBe('disconnected');

    // Wait for reconnect
    await waitFor(() => expect(status).toBe('connected'), { timeout: 5000 });
  });
});
```

---

## Task 6.2: Performance Optimization

### Description

Optimize for production load and ensure smooth gameplay.

### Work Items

- [ ] Database query optimization (indexes, explain analyze)
- [ ] Connection pooling tuning
- [ ] Memory leak detection and fixes
- [ ] Client bundle optimization
- [ ] Asset compression
- [ ] Load testing
- [ ] Caching strategies

### Performance Checklist

```typescript
// Database optimization
// Ensure these indexes exist:
CREATE INDEX idx_game_snapshots_status ON game_snapshots(status);
CREATE INDEX idx_game_events_game_created ON game_events(game_id, created_at);
CREATE INDEX idx_sessions_expires ON player_sessions(expires_at);

// Query optimization example
const getActiveGames = `
  SELECT game_id, state_snapshot->>'phase' as phase,
         jsonb_array_length(state_snapshot->'players') as player_count
  FROM game_snapshots
  WHERE status = 'lobby'
  ORDER BY created_at DESC
  LIMIT 20
`;

// Connection pool tuning
const pool = new Pool({
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000
});

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
  });

  // Alert if memory too high
  if (usage.heapUsed > 1024 * 1024 * 1024) { // 1GB
    console.warn('High memory usage detected');
  }
}, 60000);
```

### Load Testing

```javascript
// k6 load test script
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Ramp up
    { duration: '3m', target: 100 }, // Sustain
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    ws_connecting: ['p(95)<1000'], // WS connection under 1s
  },
};

export default function () {
  // Create game
  const createRes = http.post(
    `${__ENV.API_URL}/api/games`,
    JSON.stringify({
      playerCount: 2,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(createRes, { 'game created': (r) => r.status === 201 });

  const { gameId } = JSON.parse(createRes.body);

  // Join game
  const joinRes = http.post(
    `${__ENV.API_URL}/api/games/${gameId}/join`,
    JSON.stringify({
      playerName: `Player_${__VU}`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(joinRes, { 'joined game': (r) => r.status === 200 });

  sleep(1);
}
```

### Definition of Done

- [ ] Handles 100 concurrent games without degradation
- [ ] P95 API latency < 100ms
- [ ] No memory leaks over 24h run
- [ ] Client bundle < 500KB gzipped
- [ ] Load test passes

### Test Cases

```typescript
describe('Performance', () => {
  test('API responds under 100ms', async () => {
    const times: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await request(app).get('/api/games');
      times.push(Date.now() - start);
    }

    const p95 = times.sort((a, b) => a - b)[94];
    expect(p95).toBeLessThan(100);
  });

  test('no memory growth over time', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Simulate many games
    for (let i = 0; i < 100; i++) {
      const { gameId } = await gameManager.create();
      await gameManager.join(gameId, 'Alice');
      await gameManager.join(gameId, 'Bob');
      await gameManager.start(gameId);
      // Play a few moves
      // End game
    }

    // Force GC if available
    if (global.gc) global.gc();

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / initialMemory;

    expect(growth).toBeLessThan(0.5); // Less than 50% growth
  });
});
```

---

## Task 6.3: Deployment

### Description

Set up production deployment infrastructure.

### Work Items

- [ ] Docker containerization
- [ ] Docker Compose for local dev
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Environment configuration
- [ ] Health checks
- [ ] Monitoring setup
- [ ] Backup strategy

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/

RUN npm ci

COPY . .

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/shared/dist ./shared
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://jarls:jarls@postgres:5432/jarls
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: jarls
      POSTGRES_PASSWORD: jarls
      POSTGRES_DB: jarls
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### GitHub Actions CI/CD

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: jarls_test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/jarls_test
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          # Deploy commands here
          echo "Deploying..."
```

### Definition of Done

- [ ] Docker build succeeds
- [ ] Docker Compose runs locally
- [ ] CI passes on all PRs
- [ ] CD deploys on main merge
- [ ] Health checks working
- [ ] Rollback procedure documented

---

## Task 6.4: Documentation

### Description

Create documentation for users and developers.

### Work Items

- [ ] API documentation (OpenAPI)
- [ ] Game rules in-app (help screen)
- [ ] Developer setup guide
- [ ] Architecture overview
- [ ] Contributing guidelines

### README Structure

````markdown
# Jarls (Norse Wars)

A turn-based push-combat strategy game.

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/jarls.git
cd jarls

# Install dependencies
npm install

# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start development
npm run dev
```
````

## Game Rules

See [RULES.md](./docs/rules.md) for complete game rules.

## Architecture

See [ARCHITECTURE.md](./docs/architecture.md) for system design.

## API Documentation

API docs available at `/api/docs` when running the server.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT

````

### In-App Help
```typescript
function HelpScreen({ onClose }) {
  return (
    <div className="help-screen">
      <h2>How to Play</h2>

      <section>
        <h3>Objective</h3>
        <p>Win by moving your Jarl to the Throne (center) or by eliminating all other Jarls.</p>
      </section>

      <section>
        <h3>Movement</h3>
        <ul>
          <li><strong>Warriors</strong> move 1-2 hexes in a straight line</li>
          <li><strong>Jarls</strong> move 1 hex (or 2 with draft formation)</li>
        </ul>
      </section>

      <section>
        <h3>Combat</h3>
        <p>Move into an enemy to push them. Your Attack vs their Defense:</p>
        <ul>
          <li>Attack = Strength + Momentum + Support</li>
          <li>Defense = Strength + Bracing</li>
          <li>Push succeeds if Attack {'>'} Defense</li>
        </ul>
      </section>

      <section>
        <h3>Elimination</h3>
        <p>Pieces pushed off the board edge are eliminated. Lose your Jarl = you're out!</p>
      </section>

      <button onClick={onClose}>Got it!</button>
    </div>
  );
}
````

### Definition of Done

- [ ] New developer can set up in 30 minutes
- [ ] API fully documented with examples
- [ ] Game rules accessible in-game
- [ ] Architecture documented

---

## Phase 6 Checklist

### Prerequisites

- [ ] Phase 5 complete

### Completion Criteria

- [ ] Task 6.1 complete (error handling)
- [ ] Task 6.2 complete (performance)
- [ ] Task 6.3 complete (deployment)
- [ ] Task 6.4 complete (documentation)
- [ ] Production deployment successful
- [ ] Monitoring active

### Launch Readiness

- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security review complete
- [ ] Backup/restore tested
- [ ] Rollback procedure tested
- [ ] Documentation complete

---

## Post-Launch

### Monitoring Checklist

- [ ] Error rate alerts configured
- [ ] Performance alerts configured
- [ ] Uptime monitoring active
- [ ] Log aggregation working

### Future Enhancements

- [ ] Ranked matchmaking
- [ ] Game replays
- [ ] Cosmetic customization
- [ ] Tournament mode
- [ ] Mobile native apps

---

_Phase 6 Status: Not Started_
