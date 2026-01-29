import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';

interface GameSummary {
  gameId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  turnTimerMs: number | null;
  boardRadius: number;
  createdAt: string;
  players: { id: string; name: string }[];
}

/** Format relative time like "2m ago", "1h ago" */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

/** Check if game is stale (over 1 hour old) */
function isStale(dateStr: string): boolean {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const ONE_HOUR = 60 * 60 * 1000;
  return now - then > ONE_HOUR;
}

export default function GameList() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const clearGame = useGameStore((s) => s.clearGame);

  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [showStale, setShowStale] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/games');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to fetch games');
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.games ?? []);
      setGames(list as GameSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const handleJoin = useCallback(
    async (gameId: string) => {
      const name = playerName.trim();
      if (!name || joiningId) return;

      setJoiningId(gameId);
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
        const { sessionToken, playerId } = (await res.json()) as {
          sessionToken: string;
          playerId: string;
        };

        clearGame();
        setSession(sessionToken);
        setPlayer(playerId);
        navigate(`/lobby/${gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join game');
        setJoiningId(null);
      }
    },
    [playerName, joiningId, navigate, setSession, setPlayer, clearGame]
  );

  // Filter and sort games: newest first, hide stale by default
  const joinableGames = games
    .filter((g) => g.status === 'lobby' && g.playerCount < g.maxPlayers)
    .filter((g) => showStale || !isStale(g.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const staleCount = games.filter(
    (g) => g.status === 'lobby' && g.playerCount < g.maxPlayers && isStale(g.createdAt)
  ).length;

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Browse Games</h2>
      <p style={subtitleStyle}>Find an open lobby and join the battle</p>

      {/* Player Name Input */}
      <div style={inputContainerStyle}>
        <label style={labelStyle}>
          Your Viking Name
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name to join"
            maxLength={30}
            style={inputStyle}
            autoFocus
          />
        </label>
      </div>

      {/* Error */}
      {error && <p style={errorStyle}>{error}</p>}

      {/* Loading */}
      {loading && (
        <div style={loadingContainerStyle}>
          <span style={loadingTextStyle}>Searching for battles...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && joinableGames.length === 0 && (
        <div style={emptyStateStyle}>
          <span style={emptyIconStyle}>⚔</span>
          <p style={emptyTextStyle}>No open games found</p>
          <button style={createButtonStyle} onClick={() => navigate('/lobby/create')}>
            Create Your Own
          </button>
        </div>
      )}

      {/* Game List */}
      {joinableGames.length > 0 && (
        <div style={listStyle}>
          {joinableGames.map((game, index) => {
            const isNew = index === 0 && !isStale(game.createdAt);
            const gameIsStale = isStale(game.createdAt);

            return (
              <div
                key={game.gameId}
                style={{
                  ...gameCardStyle,
                  ...(isNew ? newGameCardStyle : {}),
                  ...(gameIsStale ? staleGameCardStyle : {}),
                }}
              >
                <div style={gameMainStyle}>
                  <div style={gameHeaderStyle}>
                    <span style={hostNameStyle}>
                      {game.players.length > 0 ? game.players[0].name : 'Unknown'}
                    </span>
                    {isNew && <span style={newBadgeStyle}>NEW</span>}
                    {gameIsStale && <span style={staleBadgeStyle}>OLD</span>}
                  </div>
                  <div style={gameMetaStyle}>
                    <span style={metaItemStyle}>
                      <span style={metaIconStyle}>👥</span>
                      {game.playerCount}/{game.maxPlayers}
                    </span>
                    {game.turnTimerMs && (
                      <span style={metaItemStyle}>
                        <span style={metaIconStyle}>⏱</span>
                        {game.turnTimerMs / 1000}s
                      </span>
                    )}
                    <span style={metaItemStyle}>
                      <span style={metaIconStyle}>⬡</span>
                      R{game.boardRadius}
                    </span>
                    <span style={timeAgoStyle}>{formatRelativeTime(game.createdAt)}</span>
                  </div>
                </div>
                <button
                  style={joinButtonStyle(playerName.trim().length > 0 && joiningId === null)}
                  disabled={playerName.trim().length === 0 || joiningId !== null}
                  onClick={() => handleJoin(game.gameId)}
                >
                  {joiningId === game.gameId ? '...' : 'Join'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Show stale toggle */}
      {!loading && staleCount > 0 && !showStale && (
        <button style={showStaleButtonStyle} onClick={() => setShowStale(true)}>
          Show {staleCount} older {staleCount === 1 ? 'game' : 'games'}
        </button>
      )}

      {/* Actions */}
      <div style={actionsStyle}>
        <button
          style={refreshButtonStyle}
          onClick={() => {
            setLoading(true);
            fetchGames();
          }}
        >
          Refresh
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
  gap: '20px',
  width: '100%',
  maxWidth: '520px',
  margin: '0 auto',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.8rem',
  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const subtitleStyle: React.CSSProperties = {
  margin: '-8px 0 0 0',
  fontSize: '0.85rem',
  color: '#8b949e',
};

const inputContainerStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px',
  background: 'rgba(22, 27, 34, 0.8)',
  borderRadius: '12px',
  border: '1px solid #30363d',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  fontSize: '0.85rem',
  color: '#8b949e',
  width: '100%',
};

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '8px',
  border: '2px solid #30363d',
  backgroundColor: '#0d1117',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  padding: '10px 14px',
  color: '#f85149',
  fontSize: '0.85rem',
  background: 'rgba(248, 81, 73, 0.1)',
  borderRadius: '6px',
  border: '1px solid rgba(248, 81, 73, 0.3)',
  width: '100%',
  textAlign: 'center',
};

const loadingContainerStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
};

const loadingTextStyle: React.CSSProperties = {
  color: '#8b949e',
  fontSize: '0.9rem',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 20px',
  gap: '12px',
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  opacity: 0.4,
};

const emptyTextStyle: React.CSSProperties = {
  color: '#8b949e',
  fontSize: '1rem',
  margin: 0,
};

const createButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
  color: '#0d1117',
  border: 'none',
  borderRadius: '6px',
  fontFamily: 'monospace',
  fontSize: '0.9rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: '8px',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '100%',
};

const gameCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderRadius: '10px',
  border: '1px solid #30363d',
  backgroundColor: 'rgba(22, 27, 34, 0.8)',
  transition: 'border-color 0.2s, background-color 0.2s',
};

const newGameCardStyle: React.CSSProperties = {
  borderColor: '#238636',
  background: 'linear-gradient(135deg, rgba(35, 134, 54, 0.15) 0%, rgba(22, 27, 34, 0.8) 100%)',
};

const staleGameCardStyle: React.CSSProperties = {
  opacity: 0.6,
  borderColor: '#21262d',
};

const gameMainStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  flex: 1,
  minWidth: 0,
};

const gameHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const hostNameStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: '#e6edf3',
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const newBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '2px 6px',
  background: '#238636',
  color: '#fff',
  borderRadius: '4px',
  fontWeight: 'bold',
  flexShrink: 0,
};

const staleBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '2px 6px',
  background: '#6e7681',
  color: '#fff',
  borderRadius: '4px',
  fontWeight: 'bold',
  flexShrink: 0,
};

const gameMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const metaItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.8rem',
  color: '#8b949e',
};

const metaIconStyle: React.CSSProperties = {
  fontSize: '0.75rem',
};

const timeAgoStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#6e7681',
};

function joinButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    background: enabled
      ? 'linear-gradient(135deg, #238636 0%, #2ea043 100%)'
      : '#21262d',
    color: enabled ? '#fff' : '#8b949e',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: enabled ? 'pointer' : 'default',
    flexShrink: 0,
    transition: 'transform 0.1s',
  };
}

const showStaleButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#8b949e',
  border: '1px solid #30363d',
  borderRadius: '6px',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '8px',
};

const refreshButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: '6px',
  border: '1px solid #30363d',
  backgroundColor: 'transparent',
  color: '#8b949e',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  cursor: 'pointer',
  transition: 'border-color 0.2s',
};
