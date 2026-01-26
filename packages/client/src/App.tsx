import { VERSION, GameState } from '@jarls/shared';

function App() {
  // Demonstrate that GameState type is available in client
  const initialState: GameState = {
    id: 'client-example',
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
    roundsSinceElimination: 0,
    winnerId: null,
    winCondition: null,
  };

  return (
    <div>
      <h1>Jarls</h1>
      <p>Version: {VERSION}</p>
      <p>Game Phase: {initialState.phase}</p>
    </div>
  );
}

export default App;
