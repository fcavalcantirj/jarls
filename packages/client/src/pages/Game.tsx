import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { Board } from '../components/Board/Board';
import TurnIndicator from '../components/Game/TurnIndicator';
import PlayerList from '../components/Game/PlayerList';
import GameEndModal from '../components/Modals/GameEndModal';
import HelpModal from '../components/Modals/HelpModal';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const socket = useSocket(gameId ?? null);
  const gameState = useGameStore((s) => s.gameState);
  const sessionToken = useGameStore((s) => s.sessionToken);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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

  // Timeout: if we're stuck loading for too long, show an error
  useEffect(() => {
    if (gameState || error) return; // Already loaded or errored

    const timeout = setTimeout(() => {
      if (!gameState && !error) {
        setError('Connection timed out. The game may no longer exist.');
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeout);
  }, [gameState, error]);

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

  // No session token means we can't join this game - likely a stale/bookmarked URL
  if (!sessionToken) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#e74c3c' }}>No active session for this game.</p>
        <p style={{ color: '#888', fontSize: '14px', marginTop: '8px' }}>
          This link may have expired or you need to join the game first.
        </p>
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

  // Connection error - server might be down or unreachable
  if (connectionStatus === 'error') {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#e74c3c' }}>Failed to connect to game server.</p>
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
        <Link to="/" style={linkStyle}>
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header bar */}
      <div style={headerStyle}>
        <TurnIndicator />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <PlayerList />
          <button style={helpButtonStyle} onClick={() => setHelpOpen(true)} title="How to Play">
            ?
          </button>
        </div>
      </div>

      {/* Board area */}
      <div style={boardContainerStyle} data-testid="board-container">
        <Board />
      </div>

      {/* Modals */}
      <GameEndModal />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
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
  flex: 1,
  fontFamily: 'monospace',
  color: '#e0e0e0',
  backgroundColor: '#0d1117',
};

const linkStyle: React.CSSProperties = {
  color: '#457b9d',
  marginTop: '16px',
  fontFamily: 'monospace',
};

const helpButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: '2px solid #555',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '16px',
  fontWeight: 'bold',
  cursor: 'pointer',
  flexShrink: 0,
};
