import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';

type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(httpServer: http.Server): TypedSocketIOServer {
  const io: TypedSocketIOServer = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:5173'],
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  return io;
}
