import { useParams, useLocation } from 'react-router-dom';
import { CreateGameForm, GameList, WaitingRoom } from '../components/Lobby';

export default function Lobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();

  // /lobby/:gameId -> WaitingRoom
  if (gameId) {
    return <WaitingRoom gameId={gameId} />;
  }

  // /lobby/create -> CreateGameForm
  if (location.pathname === '/lobby/create') {
    return <CreateGameForm />;
  }

  // /lobby/games -> GameList
  if (location.pathname === '/lobby/games') {
    return <GameList />;
  }

  // Fallback
  return <CreateGameForm />;
}
