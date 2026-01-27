import express, { type Express } from 'express';
import cors from 'cors';
import http from 'http';

const app: Express = express();

// JSON body parser
app.use(express.json());

// CORS configuration - allow Vite dev server
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);

export function createServer(): http.Server {
  return http.createServer(app);
}

export { app };
