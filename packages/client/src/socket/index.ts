export { getSocket, connect, disconnect } from './client';
export type {
  GameSocket,
  ClientToServerEvents,
  ServerToClientEvents,
  JoinGameResponse,
  PlayTurnResponse,
  StartGameResponse,
  StarvationChoiceResponse,
} from './client';
export { useSocket } from '@/hooks/useSocket';
