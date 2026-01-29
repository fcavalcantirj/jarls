import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import type { GroqModel, GroqDifficulty, AIConfig } from '@jarls/shared';
import { GROQ_MODEL_NAMES, DEFAULT_GROQ_MODEL } from '@jarls/shared';

type OpponentType = 'human' | 'ai';
type AIType = 'local' | 'groq';
type TurnTimer = 'none' | '30' | '60' | '120';
type BoardSize = 'default' | '4' | '5' | '6';

const GROQ_MODELS: GroqModel[] = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
];

export default function CreateGameForm() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const clearGame = useGameStore((s) => s.clearGame);
  const setAIConfig = useGameStore((s) => s.setAIConfig);

  const [playerName, setPlayerName] = useState('');
  const [opponentType, setOpponentType] = useState<OpponentType>('human');
  const [aiType, setAIType] = useState<AIType>('local');
  const [groqModel, setGroqModel] = useState<GroqModel>(DEFAULT_GROQ_MODEL);
  const [groqDifficulty, setGroqDifficulty] = useState<GroqDifficulty>('intermediate');
  const [turnTimer, setTurnTimer] = useState<TurnTimer>('none');
  const [boardSize, setBoardSize] = useState<BoardSize>('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

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
        const boardRadius = boardSize === 'default' ? undefined : Number(boardSize);
        const createRes = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerCount: 2, turnTimerMs, boardRadius }),
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

        // 3. Clear previous game state and store new session
        clearGame();
        setSession(sessionToken);
        setPlayer(playerId);

        // 4. If AI opponent, add AI player via API with full config
        if (opponentType === 'ai') {
          const aiConfig: AIConfig = {
            type: aiType,
            difficulty: groqDifficulty,
            ...(aiType === 'groq' && { model: groqModel }),
            ...(customPrompt.trim() && { customPrompt: customPrompt.trim() }),
          };

          const aiRes = await fetch(`/api/games/${gameId}/ai`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify(aiConfig),
          });
          if (!aiRes.ok) {
            const body = await aiRes.json().catch(() => ({}));
            throw new Error(body.message ?? 'Failed to add AI player');
          }

          const aiResponse = (await aiRes.json()) as { aiPlayerId: string; aiConfig?: AIConfig };
          if (aiResponse.aiConfig) {
            setAIConfig(aiResponse.aiConfig);
          }
        }

        // 5. Navigate to waiting room
        navigate(`/lobby/${gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setSubmitting(false);
      }
    },
    [
      playerName,
      opponentType,
      aiType,
      groqModel,
      groqDifficulty,
      customPrompt,
      turnTimer,
      boardSize,
      submitting,
      navigate,
      setSession,
      setPlayer,
      setAIConfig,
      clearGame,
    ]
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

        {/* AI Configuration (shown only when AI selected) */}
        {opponentType === 'ai' && (
          <>
            {/* AI Type */}
            <label style={labelStyle}>
              AI Type
              <div style={radioGroupStyle}>
                <button
                  type="button"
                  style={radioButtonStyle(aiType === 'local')}
                  onClick={() => setAIType('local')}
                >
                  Local (Fast)
                </button>
                <button
                  type="button"
                  style={radioButtonStyle(aiType === 'groq')}
                  onClick={() => setAIType('groq')}
                >
                  Groq LLM
                </button>
              </div>
            </label>

            {/* Groq Model Selection */}
            {aiType === 'groq' && (
              <>
                <label style={labelStyle}>
                  Model
                  <select
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value as GroqModel)}
                    style={selectStyle}
                  >
                    {GROQ_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {GROQ_MODEL_NAMES[model]}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  Difficulty
                  <select
                    value={groqDifficulty}
                    onChange={(e) => setGroqDifficulty(e.target.value as GroqDifficulty)}
                    style={selectStyle}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>

                {/* Edit Prompt Button */}
                <button
                  type="button"
                  style={editPromptButtonStyle}
                  onClick={() => setShowPromptEditor(!showPromptEditor)}
                >
                  {showPromptEditor ? 'Hide Prompt Editor' : 'Edit Prompt ✏️'}
                </button>

                {/* Custom Prompt Textarea */}
                {showPromptEditor && (
                  <label style={labelStyle}>
                    Custom Prompt (optional)
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Leave empty to use the default prompt for the selected difficulty..."
                      style={textareaStyle}
                      rows={6}
                      maxLength={5000}
                    />
                    <span style={charCountStyle}>{customPrompt.length}/5000 characters</span>
                  </label>
                )}

                {/* Powered by Groq badge */}
                <a
                  href="https://groq.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ alignSelf: 'center', marginTop: '4px' }}
                >
                  <img
                    src="https://console.groq.com/powered-by-groq-dark.svg"
                    alt="Powered by Groq for fast inference."
                    style={{ height: '24px' }}
                  />
                </a>
              </>
            )}
          </>
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

        {/* Board Size */}
        <label style={labelStyle}>
          Board Size
          <select
            value={boardSize}
            onChange={(e) => setBoardSize(e.target.value as BoardSize)}
            style={selectStyle}
          >
            <option value="default">Default (37 hexes)</option>
            <option value="4">Medium (61 hexes)</option>
            <option value="5">Large (91 hexes)</option>
            <option value="6">Extra Large (127 hexes)</option>
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

const textareaStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#1a1a2e',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '12px',
  outline: 'none',
  resize: 'vertical',
  minHeight: '100px',
};

const charCountStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#666',
  alignSelf: 'flex-end',
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

const editPromptButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px dashed #666',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '12px',
  cursor: 'pointer',
  textAlign: 'center',
};

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
