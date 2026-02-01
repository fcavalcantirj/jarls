import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import { useSocket } from '../../hooks/useSocket';
import { GameEvents } from '../../lib/analytics';

// localStorage key for persisting player name (shared with CreateGameForm)
const PLAYER_NAME_KEY = 'jarls-player-name';

interface WaitingRoomProps {
  gameId: string;
}

export default function WaitingRoom({ gameId }: WaitingRoomProps) {
  const navigate = useNavigate();
  const socket = useSocket(gameId);
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const sessionToken = useGameStore((s) => s.sessionToken);
  const connectionStatus = useGameStore((s) => s.connectionStatus);

  const setGameState = useGameStore((s) => s.setGameState);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setSession = useGameStore((s) => s.setSession);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Join form state (for shareable URL - when visitor has no session)
  const [joinName, setJoinName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PLAYER_NAME_KEY) || '';
    }
    return '';
  });
  const [joining, setJoining] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Determine host status: first player in the list is the host
  const isHost =
    gameState != null &&
    playerId != null &&
    gameState.players.length > 0 &&
    gameState.players[0].id === playerId;

  const maxPlayers = gameState?.config.playerCount ?? 2;
  const playerCount = gameState?.players.length ?? 0;
  const canStart = isHost && playerCount >= 2;

  // Join the socket room once connected
  useEffect(() => {
    if (!socket || !sessionToken || joined) return;
    if (connectionStatus !== 'connected') return;

    socket.emit('joinGame', { gameId, sessionToken }, (response) => {
      if (response.success) {
        setJoined(true);
        // Store player ID and game state from server response
        if (response.playerId) {
          setPlayer(response.playerId);
        }
        if (response.gameState) {
          setGameState(response.gameState);
        }
        // Track successful join
        GameEvents.multiplayerJoined(gameId);
      } else {
        setError(response.error ?? 'Failed to join game room');
      }
    });
  }, [socket, sessionToken, gameId, joined, connectionStatus, setPlayer, setGameState]);

  // Navigate to game page when the game starts (phase changes from lobby)
  useEffect(() => {
    if (gameState && gameState.phase !== 'lobby') {
      navigate(`/game/${gameId}`);
    }
  }, [gameState, gameId, navigate]);

  const handleStart = useCallback(() => {
    if (!socket || !canStart || starting) return;
    setStarting(true);
    setError(null);

    socket.emit('startGame', { gameId }, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        setError(response.error ?? 'Failed to start game');
        setStarting(false);
      } else {
        // Track game start - multiplayer mode
        GameEvents.gameStart('multiplayer');
      }
      // On success, the server will emit gameState with a new phase,
      // and the useEffect above will navigate to the game page.
    });
  }, [socket, canStart, starting, gameId]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleCopyInvite = useCallback(async () => {
    const inviteUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, []);

  // Join game via API (for shareable URL - when visitor has no session)
  const handleJoin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = joinName.trim();
      if (!name || joining) return;

      setJoining(true);
      setError(null);

      try {
        const res = await fetch(`/api/games/${gameId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: name }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? 'Failed to join game');
        }

        const { sessionToken: token, playerId: pid } = (await res.json()) as {
          sessionToken: string;
          playerId: string;
        };

        // Store session and player
        setSession(token);
        setPlayer(pid);

        // Save name for future sessions
        localStorage.setItem(PLAYER_NAME_KEY, name);

        // Track join
        GameEvents.multiplayerJoined(gameId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join game');
        setJoining(false);
      }
    },
    [joinName, joining, gameId, setSession, setPlayer]
  );

  // No session token - show join form (shareable URL scenario)
  if (!sessionToken) {
    return (
      <div style={containerStyle}>
        <h2 style={titleStyle}>Join Game</h2>
        <div style={gameIdStyle}>
          Game: <span style={gameIdValueStyle}>{gameId.slice(0, 8)}...</span>
        </div>

        <form onSubmit={handleJoin} style={joinFormStyle}>
          <label style={labelStyle}>
            Your Name
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Enter your name"
              maxLength={30}
              style={inputStyle}
              autoFocus
              disabled={joining}
            />
          </label>

          {error && <p style={errorStyle}>{error}</p>}

          <button
            type="submit"
            style={joinButtonStyle(joinName.trim().length > 0 && !joining)}
            disabled={joinName.trim().length === 0 || joining}
          >
            {joining ? 'Joining...' : 'Join Game'}
          </button>
        </form>

        <button style={backButtonStyle} onClick={handleBack}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Waiting Room</h2>

      <div style={gameIdStyle}>
        Game: <span style={gameIdValueStyle}>{gameId.slice(0, 8)}...</span>
      </div>

      {/* Connection status */}
      {connectionStatus !== 'connected' && (
        <div style={statusBannerStyle}>
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'disconnected' && 'Disconnected'}
          {connectionStatus === 'error' && 'Connection error'}
        </div>
      )}

      {/* Player slots */}
      <div style={slotsContainerStyle}>
        <h3 style={slotsTitle}>
          Players ({playerCount}/{maxPlayers})
        </h3>
        {Array.from({ length: maxPlayers }).map((_, i) => {
          const player = gameState?.players[i];
          return (
            <div key={i} style={slotStyle(!!player)}>
              {player ? (
                <span style={playerNameStyle}>
                  {player.name}
                  {i === 0 && <span style={hostBadgeStyle}> HOST</span>}
                  {player.id === playerId && <span style={youBadgeStyle}> (you)</span>}
                </span>
              ) : (
                <span style={emptySlotStyle}>Waiting for player...</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite Link */}
      <button style={inviteButtonStyle} onClick={handleCopyInvite}>
        {linkCopied ? '✓ Link Copied!' : 'Copy Invite Link'}
      </button>

      {/* Error */}
      {error && <p style={errorStyle}>{error}</p>}

      {/* Actions */}
      <div style={actionsStyle}>
        {isHost ? (
          <button
            style={startButtonStyle(canStart && !starting)}
            disabled={!canStart || starting}
            onClick={handleStart}
          >
            {starting ? 'Starting...' : canStart ? 'Start Game' : 'Waiting for players...'}
          </button>
        ) : (
          <p style={waitingTextStyle}>Waiting for host to start the game...</p>
        )}
        <button style={backButtonStyle} onClick={handleBack}>
          Leave
        </button>
      </div>
    </div>
  );
}

/* --- Styles --- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 16px',
  fontFamily: 'monospace',
  color: '#e0e0e0',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: '24px',
  color: '#ffd700',
};

const gameIdStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#888',
  marginBottom: '20px',
};

const gameIdValueStyle: React.CSSProperties = {
  color: '#aaa',
  fontWeight: 'bold',
};

const statusBannerStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  backgroundColor: '#553300',
  color: '#ffaa00',
  fontSize: '13px',
  marginBottom: '16px',
};

const slotsContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '360px',
  marginBottom: '16px',
};

const inviteButtonStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '360px',
  padding: '12px 20px',
  marginBottom: '16px',
  borderRadius: '6px',
  border: '2px solid #58a6ff',
  backgroundColor: '#1a2d4a',
  color: '#58a6ff',
  fontFamily: 'monospace',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const slotsTitle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: '16px',
  color: '#ccc',
};

function slotStyle(filled: boolean): React.CSSProperties {
  return {
    padding: '12px 16px',
    borderRadius: '6px',
    border: filled ? '2px solid #457b9d' : '2px dashed #555',
    backgroundColor: filled ? '#1a2a3e' : '#1a1a2e',
    marginBottom: '8px',
    fontSize: '14px',
  };
}

const playerNameStyle: React.CSSProperties = {
  color: '#e0e0e0',
  fontWeight: 'bold',
};

const hostBadgeStyle: React.CSSProperties = {
  color: '#ffd700',
  fontSize: '11px',
  fontWeight: 'bold',
  marginLeft: '4px',
};

const youBadgeStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '12px',
  fontWeight: 'normal',
};

const emptySlotStyle: React.CSSProperties = {
  color: '#666',
  fontStyle: 'italic',
};

const errorStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  color: '#e74c3c',
  fontSize: '13px',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  width: '100%',
  maxWidth: '360px',
  alignItems: 'center',
};

function startButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: enabled ? '#2ecc71' : '#444',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
  };
}

const waitingTextStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '14px',
  textAlign: 'center',
  margin: 0,
};

const backButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
};

// Join form styles (for shareable URL)
const joinFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  width: '100%',
  maxWidth: '360px',
  marginBottom: '16px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px',
  color: '#aaa',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#1a1a2e',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '16px',
  outline: 'none',
};

function joinButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: enabled ? '#2ecc71' : '#444',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
  };
}
