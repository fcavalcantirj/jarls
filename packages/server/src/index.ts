// @jarls/server - Game server

import { VERSION, GameState } from '@jarls/shared';

console.log(`Jarls Server v${VERSION}`);

// Demonstrate that GameState type is available
const exampleState: GameState = {
  id: 'example',
  phase: 'lobby',
  config: {
    playerCount: 2,
    boardRadius: 3,
    shieldCount: 5,
    warriorCount: 5,
    turnTimerMs: null,
  },
  players: [],
  pieces: [],
  currentPlayerId: null,
  turnNumber: 0,
  roundNumber: 0,
  firstPlayerIndex: 0,
  roundsSinceElimination: 0,
  winnerId: null,
  winCondition: null,
};

console.log(`Game state phase: ${exampleState.phase}`);
