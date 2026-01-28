import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { Board } from '../components/Board/Board';
import TurnIndicator from '../components/Game/TurnIndicator';
import PlayerList from '../components/Game/PlayerList';
import GameEndModal from '../components/Modals/GameEndModal';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const socket = useSocket(gameId ?? null);
  const gameState = useGameStore((s) => s.gameState);
  const sessionToken = useGameStore((s) => s.sessionToken);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join the socket room once connected
  useEffect(() => {
    if (!socket || !sessionToken || !gameId || joined) return;
    if (connectionStatus !== 'connected') return;

    socket.emit('joinGame', { gameId, sessionToken }, (response) => {
      if (response.success) {
        setJoined(true);
      } else {
        setError(response.error ?? 'Failed to join game room');
      }
    });
  }, [socket, sessionToken, gameId, joined, connectionStatus]);

  if (!gameId) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#e74c3c' }}>No game ID provided.</p>
        <Link to="/" style={linkStyle}>
          Back to Home
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#e74c3c' }}>{error}</p>
        <Link to="/" style={linkStyle}>
          Back to Home
        </Link>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#888' }}>
          {connectionStatus === 'connecting' ? 'Connecting...' : 'Loading game...'}
        </p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header bar */}
      <div style={headerStyle}>
        <TurnIndicator />
        <PlayerList />
      </div>

      {/* Board area */}
      <div style={boardContainerStyle} data-testid="board-container">
        <Board />
      </div>

      {/* Game end modal overlay */}
      <GameEndModal />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: '#0d1117',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '12px 16px',
  gap: '12px',
  flexShrink: 0,
};

const boardContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  minHeight: 0,
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  fontFamily: 'monospace',
  color: '#e0e0e0',
  backgroundColor: '#0d1117',
};

const linkStyle: React.CSSProperties = {
  color: '#457b9d',
  marginTop: '16px',
  fontFamily: 'monospace',
};
