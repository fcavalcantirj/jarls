import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorMiddleware } from './middleware/error.js';
import { createGameRoutes } from './routes/games.js';
import { GameManager } from './game/manager.js';
import { createSocketServer } from './socket/server.js';
import { registerSocketHandlers } from './socket/handlers.js';

const app: Express = express();
const gameManager = new GameManager();

// Security headers
app.use(helmet());

// JSON body parser
app.use(express.json());

// CORS configuration - allow Vite dev server
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/games', createGameRoutes(gameManager));

// In production, serve the client build as static files
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for non-API routes
  app.get('*', (_req: Request, res: Response, next: NextFunction) => {
    if (
      _req.path.startsWith('/api') ||
      _req.path.startsWith('/socket.io') ||
      _req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error middleware (must be after all routes)
app.use(errorMiddleware);

export function createServer() {
  const httpServer = http.createServer(app);
  const io = createSocketServer(httpServer);
  registerSocketHandlers(io, gameManager);
  return { httpServer, io };
}

export { app, gameManager };
