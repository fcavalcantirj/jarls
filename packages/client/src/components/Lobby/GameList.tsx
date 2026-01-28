import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';

interface GameSummary {
  gameId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  turnTimerMs: number | null;
  createdAt: string;
  players: { id: string; name: string }[];
}

export default function GameList() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');

  const fetchGames = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/games');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to fetch games');
      }
      const data = (await res.json()) as GameSummary[];
      setGames(data);
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

        setSession(sessionToken);
        setPlayer(playerId);
        navigate(`/lobby/${gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join game');
        setJoiningId(null);
      }
    },
    [playerName, joiningId, navigate, setSession, setPlayer]
  );

  const joinableGames = games.filter((g) => g.status === 'lobby' && g.playerCount < g.maxPlayers);

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Join Game</h2>

      {/* Player Name Input */}
      <label style={labelStyle}>
        Your Name
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          maxLength={30}
          style={inputStyle}
          autoFocus
        />
      </label>

      {/* Error */}
      {error && <p style={errorStyle}>{error}</p>}

      {/* Loading */}
      {loading && <p style={statusStyle}>Loading games...</p>}

      {/* Empty State */}
      {!loading && joinableGames.length === 0 && (
        <p style={statusStyle}>No games available. Create one instead!</p>
      )}

      {/* Game List */}
      {joinableGames.length > 0 && (
        <div style={listStyle}>
          {joinableGames.map((game) => (
            <div key={game.gameId} style={gameCardStyle}>
              <div style={gameInfoStyle}>
                <span style={gameIdStyle}>{game.gameId.slice(0, 8)}</span>
                <span style={playerCountStyle}>
                  {game.playerCount}/{game.maxPlayers} players
                </span>
                {game.turnTimerMs && (
                  <span style={timerBadgeStyle}>{game.turnTimerMs / 1000}s timer</span>
                )}
                {game.players.length > 0 && (
                  <span style={hostStyle}>Host: {game.players[0].name}</span>
                )}
              </div>
              <button
                style={joinButtonStyle(playerName.trim().length > 0 && joiningId === null)}
                disabled={playerName.trim().length === 0 || joiningId !== null}
                onClick={() => handleJoin(game.gameId)}
              >
                {joiningId === game.gameId ? 'Joining...' : 'Join'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Refresh */}
      {!loading && (
        <button
          style={refreshStyle}
          onClick={() => {
            setLoading(true);
            fetchGames();
          }}
        >
          Refresh
        </button>
      )}

      {/* Back */}
      <button style={backStyle} onClick={() => navigate('/')}>
        Back
      </button>
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
  gap: '16px',
  width: '100%',
  maxWidth: '480px',
  margin: '0 auto',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '24px',
  color: '#ffd700',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px',
  color: '#aaa',
  width: '100%',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#1a1a2e',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '14px',
  outline: 'none',
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: '#e74c3c',
  fontSize: '13px',
};

const statusStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '14px',
  margin: '16px 0',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  width: '100%',
};

const gameCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderRadius: '6px',
  border: '1px solid #555',
  backgroundColor: '#1a1a2e',
};

const gameInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const gameIdStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#e0e0e0',
  fontWeight: 'bold',
};

const playerCountStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#888',
};

const timerBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#ffd700',
};

const hostStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#aaa',
};

function joinButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: enabled ? '#2ecc71' : '#444',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
    flexShrink: 0,
  };
}

const refreshStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '6px',
  border: '1px solid #555',
  backgroundColor: 'transparent',
  color: '#aaa',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
  marginTop: '8px',
};

const backStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
  textDecoration: 'underline',
};
