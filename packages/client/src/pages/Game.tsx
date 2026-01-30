import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { Board } from '../components/Board/Board';
import TurnIndicator from '../components/Game/TurnIndicator';
import PlayerList from '../components/Game/PlayerList';
import GameEndModal from '../components/Modals/GameEndModal';
import HelpModal from '../components/Modals/HelpModal';
import AISettingsModal from '../components/Modals/AISettingsModal';
import type { AIConfig } from '@jarls/shared';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const socket = useSocket(gameId ?? null);
  const gameState = useGameStore((s) => s.gameState);
  const sessionToken = useGameStore((s) => s.sessionToken);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const aiConfig = useGameStore((s) => s.aiConfig);
  const setAIConfig = useGameStore((s) => s.setAIConfig);

  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aiSettingsOpen, setAISettingsOpen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);

  // Detect portrait/landscape orientation on mobile
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobile && isPortrait);
      setIsLandscapeMobile(isMobile && !isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

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

  // Listen for AI config updates
  useEffect(() => {
    if (!socket) return;

    const handleAIConfigUpdated = (data: { config: AIConfig }) => {
      setAIConfig(data.config);
    };

    socket.on('aiConfigUpdated', handleAIConfigUpdated);

    return () => {
      socket.off('aiConfigUpdated', handleAIConfigUpdated);
    };
  }, [socket, setAIConfig]);

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

  // Handle AI settings save
  const handleSaveAISettings = useCallback(
    (config: Partial<AIConfig>) => {
      if (!socket || !gameId) return;

      socket.emit('updateAIConfig', { gameId, config }, (response) => {
        if (response.success && response.config) {
          setAIConfig(response.config);
        } else {
          console.error('Failed to update AI config:', response.error);
        }
      });
    },
    [socket, gameId, setAIConfig]
  );

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

  const showAISettings = aiConfig !== null;

  // Dynamic styles for landscape mobile
  const dynamicPageStyle: React.CSSProperties = {
    ...pageStyle,
    ...(isLandscapeMobile && {
      overflow: 'auto',
      minHeight: '100%',
    }),
  };

  const dynamicBoardContainerStyle: React.CSSProperties = {
    ...boardContainerStyle,
    ...(isLandscapeMobile && {
      minHeight: '80vw', // Board needs square-ish space, use width as reference
      flex: 'none', // Don't let flex shrink the board
    }),
  };

  return (
    <div style={dynamicPageStyle}>
      {/* Landscape warning overlay for portrait mobile */}
      {isPortraitMobile && (
        <div style={landscapeWarningStyle}>
          <span style={{ fontSize: '48px' }}>↻</span>
          <p style={{ margin: '16px 0 0 0', fontSize: '16px', textAlign: 'center' }}>
            Rotate your device to landscape for the best experience
          </p>
        </div>
      )}

      {/* Header bar */}
      <div style={headerStyle}>
        <TurnIndicator />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <PlayerList />
          {showAISettings && (
            <button
              style={settingsButtonStyle}
              onClick={() => setAISettingsOpen(true)}
              title="AI Settings"
            >
              &#9881;
            </button>
          )}
          <button style={helpButtonStyle} onClick={() => setHelpOpen(true)} title="How to Play">
            ?
          </button>
        </div>
      </div>

      {/* Board area */}
      <div style={dynamicBoardContainerStyle} data-testid="board-container">
        <Board />
      </div>

      {/* Modals */}
      <GameEndModal />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AISettingsModal
        isOpen={aiSettingsOpen}
        onClose={() => setAISettingsOpen(false)}
        onSave={handleSaveAISettings}
      />
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
  padding: '8px 12px',
  gap: '8px',
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

const settingsButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  border: '2px solid #555',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '16px',
  cursor: 'pointer',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const landscapeWarningStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(13, 17, 23, 0.95)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffd700',
  fontFamily: 'monospace',
  zIndex: 1000,
  padding: '20px',
};
