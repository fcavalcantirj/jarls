import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';

type OpponentType = 'human' | 'ai';
type AIDifficulty = 'random' | 'heuristic';
type TurnTimer = 'none' | '30' | '60' | '120';

export default function CreateGameForm() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setPlayer = useGameStore((s) => s.setPlayer);

  const [playerName, setPlayerName] = useState('');
  const [opponentType, setOpponentType] = useState<OpponentType>('human');
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>('heuristic');
  const [turnTimer, setTurnTimer] = useState<TurnTimer>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const name = playerName.trim();
      if (!name || submitting) return;

      setSubmitting(true);
      setError(null);

      try {
        // 1. Create game
        const turnTimerMs = turnTimer === 'none' ? null : Number(turnTimer) * 1000;
        const createRes = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerCount: 2, turnTimerMs }),
        });
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}));
          throw new Error(body.message ?? 'Failed to create game');
        }
        const { gameId } = (await createRes.json()) as { gameId: string };

        // 2. Join game
        const joinRes = await fetch(`/api/games/${gameId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: name }),
        });
        if (!joinRes.ok) {
          const body = await joinRes.json().catch(() => ({}));
          throw new Error(body.message ?? 'Failed to join game');
        }
        const { sessionToken, playerId } = (await joinRes.json()) as {
          sessionToken: string;
          playerId: string;
        };

        // 3. Store session
        setSession(sessionToken);
        setPlayer(playerId);

        // 4. If AI opponent, add AI player via API
        if (opponentType === 'ai') {
          const aiRes = await fetch(`/api/games/${gameId}/ai`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({ difficulty: aiDifficulty }),
          });
          if (!aiRes.ok) {
            const body = await aiRes.json().catch(() => ({}));
            throw new Error(body.message ?? 'Failed to add AI player');
          }
        }

        // 5. Navigate to waiting room
        navigate(`/lobby/${gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setSubmitting(false);
      }
    },
    [playerName, opponentType, aiDifficulty, turnTimer, submitting, navigate, setSession, setPlayer]
  );

  const isValid = playerName.trim().length > 0;

  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>Create Game</h2>

      <form onSubmit={handleSubmit} style={formStyle}>
        {/* Player Name */}
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

        {/* Opponent Type */}
        <label style={labelStyle}>
          Opponent
          <div style={radioGroupStyle}>
            <button
              type="button"
              style={radioButtonStyle(opponentType === 'human')}
              onClick={() => setOpponentType('human')}
            >
              Human
            </button>
            <button
              type="button"
              style={radioButtonStyle(opponentType === 'ai')}
              onClick={() => setOpponentType('ai')}
            >
              AI
            </button>
          </div>
        </label>

        {/* AI Difficulty (shown only when AI selected) */}
        {opponentType === 'ai' && (
          <label style={labelStyle}>
            AI Difficulty
            <select
              value={aiDifficulty}
              onChange={(e) => setAIDifficulty(e.target.value as AIDifficulty)}
              style={selectStyle}
            >
              <option value="heuristic">Normal</option>
              <option value="random">Random</option>
            </select>
          </label>
        )}

        {/* Turn Timer */}
        <label style={labelStyle}>
          Turn Timer
          <select
            value={turnTimer}
            onChange={(e) => setTurnTimer(e.target.value as TurnTimer)}
            style={selectStyle}
          >
            <option value="none">No Timer</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
            <option value="120">120 seconds</option>
          </select>
        </label>

        {/* Error */}
        {error && <p style={errorStyle}>{error}</p>}

        {/* Submit */}
        <button
          type="submit"
          style={submitStyle(isValid && !submitting)}
          disabled={!isValid || submitting}
        >
          {submitting ? 'Creating...' : 'Create Game'}
        </button>
      </form>
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
  margin: '0 0 24px 0',
  fontSize: '24px',
  color: '#ffd700',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  width: '100%',
  maxWidth: '360px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px',
  color: '#aaa',
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

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#1a1a2e',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '14px',
  outline: 'none',
};

const radioGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

function radioButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: active ? '2px solid #ffd700' : '2px solid #555',
    backgroundColor: active ? '#2a2a4e' : '#1a1a2e',
    color: active ? '#ffd700' : '#888',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: active ? 'bold' : 'normal',
    cursor: 'pointer',
    textAlign: 'center',
  };
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: '#e74c3c',
  fontSize: '13px',
};

function submitStyle(enabled: boolean): React.CSSProperties {
  return {
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
    marginTop: '8px',
  };
}
