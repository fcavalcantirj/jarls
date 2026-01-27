import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { errorMiddleware } from './middleware/error.js';

const app: Express = express();

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

// Error middleware (must be after all routes)
app.use(errorMiddleware);

export function createServer(): http.Server {
  return http.createServer(app);
}

export { app };
