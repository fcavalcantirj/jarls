import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

export function createSocketServer(httpServer: http.Server): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:5173'],
      credentials: true,
    },
  });

  return io;
}
