import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';
import type { GroqModel, GroqDifficulty, AIConfig } from '@jarls/shared';
import { GROQ_MODEL_NAMES, DEFAULT_GROQ_MODEL, DIFFICULTY_PROMPTS } from '@jarls/shared';
import { GameEvents } from '../../lib/analytics';

type Preset = 'easy' | 'medium' | 'hard' | 'custom';
type AIType = 'local' | 'groq';
type TurnTimer = 'none' | '30' | '60' | '120';
type BoardSize = 'default' | '4' | '5' | '6';
type Terrain = 'calm' | 'treacherous' | 'chaotic';

const GROQ_MODELS: GroqModel[] = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
];

// Preset configurations
const PRESETS: Record<
  Exclude<Preset, 'custom'>,
  { aiType: AIType; model?: GroqModel; difficulty: GroqDifficulty; description: string }
> = {
  easy: {
    aiType: 'local',
    difficulty: 'beginner',
    description: 'Quick & Simple - Local AI opponent',
  },
  medium: {
    aiType: 'groq',
    model: 'llama-3.1-8b-instant',
    difficulty: 'intermediate',
    description: 'Balanced Challenge - Groq-powered AI',
  },
  hard: {
    aiType: 'groq',
    model: 'llama-3.3-70b-versatile',
    difficulty: 'hard',
    description: 'Expert Mode - Smartest AI, aggressive tactics',
  },
};

// localStorage key for persisting player name
const PLAYER_NAME_KEY = 'jarls-player-name';

export default function CreateGameForm() {
  const navigate = useNavigate();
  const setSession = useGameStore((s) => s.setSession);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const clearGame = useGameStore((s) => s.clearGame);
  const setAIConfig = useGameStore((s) => s.setAIConfig);

  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PLAYER_NAME_KEY) || '';
    }
    return '';
  });
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Custom form state
  const [aiType, setAIType] = useState<AIType>('local');
  const [groqModel, setGroqModel] = useState<GroqModel>(DEFAULT_GROQ_MODEL);
  const [groqDifficulty, setGroqDifficulty] = useState<GroqDifficulty>('intermediate');
  const [turnTimer, setTurnTimer] = useState<TurnTimer>('none');
  const [boardSize, setBoardSize] = useState<BoardSize>('default');
  const [terrain, setTerrain] = useState<Terrain>('calm');
  const [customPrompt, setCustomPrompt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGame = useCallback(
    async (config: {
      aiType: AIType;
      model?: GroqModel;
      difficulty: GroqDifficulty;
      customPrompt?: string;
      turnTimerMs: number | null;
      boardRadius?: number;
      terrain?: Terrain;
    }) => {
      const name = playerName.trim();
      if (!name || submitting) return;

      setSubmitting(true);
      setError(null);

      try {
        // 1. Create game (max 6 players - allows humans to gang up vs AI)
        const createRes = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerCount: 6,
            turnTimerMs: config.turnTimerMs,
            boardRadius: config.boardRadius,
            terrain: config.terrain,
          }),
        });
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({}));
          throw new Error(body.message ?? 'Failed to create game');
        }
        const { gameId } = (await createRes.json()) as { gameId: string };

        // Track game creation
        GameEvents.multiplayerCreated(gameId);

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

        // 4. Add AI player via API with full config
        const aiConfig: AIConfig = {
          type: config.aiType,
          difficulty: config.difficulty,
          ...(config.aiType === 'groq' && config.model && { model: config.model }),
          ...(config.customPrompt?.trim() && { customPrompt: config.customPrompt.trim() }),
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

        // 5. Save player name to localStorage for future sessions
        localStorage.setItem(PLAYER_NAME_KEY, name);

        // 6. Navigate to waiting room (allows more humans to join vs AI)
        navigate(`/lobby/${gameId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setSubmitting(false);
      }
    },
    [playerName, submitting, navigate, setSession, setPlayer, setAIConfig, clearGame]
  );

  const handlePresetClick = useCallback(
    async (preset: Preset) => {
      if (preset === 'custom') {
        setSelectedPreset('custom');
        setShowCustomForm(true);
        return;
      }

      const name = playerName.trim();
      if (!name) {
        setError('Please enter your name first');
        return;
      }

      setSelectedPreset(preset);
      const presetConfig = PRESETS[preset];
      await createGame({
        aiType: presetConfig.aiType,
        model: presetConfig.model,
        difficulty: presetConfig.difficulty,
        turnTimerMs: null,
      });
    },
    [playerName, createGame]
  );

  // Create multiplayer game (human vs human)
  const createMultiplayerGame = useCallback(async () => {
    const name = playerName.trim();
    if (!name || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create game (max 6 players - host can start when ready)
      const createRes = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: 6 }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to create game');
      }
      const { gameId } = (await createRes.json()) as { gameId: string };

      // Track game creation
      GameEvents.multiplayerCreated(gameId);

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

      // 4. Save player name to localStorage for future sessions
      localStorage.setItem(PLAYER_NAME_KEY, name);

      // 5. Navigate to waiting room (human opponent will join via Browse)
      navigate(`/lobby/${gameId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }, [playerName, submitting, navigate, setSession, setPlayer, clearGame]);

  const handleMultiplayerClick = useCallback(async () => {
    const name = playerName.trim();
    if (!name) {
      setError('Please enter your name first');
      return;
    }
    setSelectedPreset(null);
    await createMultiplayerGame();
  }, [playerName, createMultiplayerGame]);

  const handleCustomSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const turnTimerMs = turnTimer === 'none' ? null : Number(turnTimer) * 1000;
      const boardRadius = boardSize === 'default' ? undefined : Number(boardSize);

      await createGame({
        aiType,
        model: aiType === 'groq' ? groqModel : undefined,
        difficulty: groqDifficulty,
        customPrompt: customPrompt || undefined,
        turnTimerMs,
        boardRadius,
        terrain,
      });
    },
    [aiType, groqModel, groqDifficulty, customPrompt, turnTimer, boardSize, terrain, createGame]
  );

  const isNameValid = playerName.trim().length > 0;

  // Get the default prompt for the current difficulty to show in the textarea
  const defaultPrompt = useMemo(() => DIFFICULTY_PROMPTS[groqDifficulty], [groqDifficulty]);

  return (
    <div style={containerStyle}>
      <div style={titleRowStyle}>
        {showCustomForm && (
          <button type="button" onClick={() => setShowCustomForm(false)} style={backButtonStyle}>
            ←
          </button>
        )}
        <h2 style={titleStyle}>Create Game</h2>
      </div>

      {/* Name Input - Always shown */}
      <div style={nameContainerStyle}>
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
      </div>

      {/* Error */}
      {error && <p style={errorStyle}>{error}</p>}

      {/* Preset Buttons - Always shown unless Custom form is expanded */}
      {!showCustomForm && (
        <>
          <p style={chooseDifficultyStyle}>Choose Difficulty</p>
          <div style={presetsContainerStyle}>
            <button
              type="button"
              style={presetButtonStyle('easy', selectedPreset, submitting)}
              onClick={() => handlePresetClick('easy')}
              disabled={submitting}
            >
              <span style={presetLabelStyle}>Easy</span>
              <span style={presetDescStyle}>{PRESETS.easy.description}</span>
            </button>
            <button
              type="button"
              style={presetButtonStyle('medium', selectedPreset, submitting)}
              onClick={() => handlePresetClick('medium')}
              disabled={submitting}
            >
              <span style={presetLabelStyle}>Medium</span>
              <span style={presetDescStyle}>{PRESETS.medium.description}</span>
            </button>
            <button
              type="button"
              style={presetButtonStyle('hard', selectedPreset, submitting)}
              onClick={() => handlePresetClick('hard')}
              disabled={submitting}
            >
              <span style={presetLabelStyle}>Hard</span>
              <span style={presetDescStyle}>{PRESETS.hard.description}</span>
            </button>
            <button
              type="button"
              style={multiplayerButtonStyle(submitting)}
              onClick={handleMultiplayerClick}
              disabled={submitting}
            >
              <span style={presetLabelStyle}>Multiplayer</span>
              <span style={presetDescStyle}>Play against a human</span>
            </button>
            <button
              type="button"
              style={customButtonStyle(submitting)}
              onClick={() => handlePresetClick('custom')}
              disabled={submitting}
            >
              <span style={presetLabelStyle}>Custom</span>
              <span style={presetDescStyle}>Customize AI, board size, timer...</span>
            </button>
          </div>
          {submitting && <p style={loadingStyle}>Creating game...</p>}
          <a href="/lobby/games" style={presetBrowseButtonStyle}>
            Or browse existing games →
          </a>
        </>
      )}

      {/* Custom Form - Shown when Custom is selected */}
      {showCustomForm && (
        <form onSubmit={handleCustomSubmit} style={customFormStyle}>
          <label style={fullWidthLabelStyle}>
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

          {aiType === 'groq' && (
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
          )}

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

          <label style={labelStyle}>
            Terrain
            <select
              value={terrain}
              onChange={(e) => setTerrain(e.target.value as Terrain)}
              style={selectStyle}
            >
              <option value="calm">Calm (few holes)</option>
              <option value="treacherous">Treacherous (more holes)</option>
              <option value="chaotic">Chaotic (many holes)</option>
            </select>
          </label>

          {aiType === 'groq' && (
            <label style={fullWidthLabelStyle}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>System Prompt</span>
                {customPrompt && (
                  <button
                    type="button"
                    onClick={() => setCustomPrompt('')}
                    style={resetPromptButtonStyle}
                  >
                    Reset
                  </button>
                )}
              </div>
              <textarea
                value={customPrompt || defaultPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                style={textareaStyle}
                maxLength={5000}
              />
              <span style={charCountStyle}>{(customPrompt || defaultPrompt).length}/5000</span>
            </label>
          )}

          <div style={buttonRowStyle}>
            <button
              type="submit"
              style={submitStyle(isNameValid && !submitting)}
              disabled={!isNameValid || submitting}
            >
              {submitting ? 'Creating...' : 'Create Game'}
            </button>
            <a href="/lobby/games" style={browseButtonStyle}>
              Browse
            </a>
          </div>
        </form>
      )}

      {showCustomForm && aiType === 'groq' && (
        <a
          href="https://groq.com"
          target="_blank"
          rel="noopener noreferrer"
          style={groqBadgeLinkStyle}
        >
          <img
            src="https://console.groq.com/powered-by-groq-dark.svg"
            alt="Powered by Groq for fast inference."
            style={{ height: '24px', maxWidth: '100%' }}
          />
        </a>
      )}
    </div>
  );
}

/* --- Styles --- */

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '24px 16px',
  fontFamily: 'monospace',
  color: '#e0e0e0',
  overflow: 'auto',
  gap: '16px',
  flex: 1,
  minHeight: 0,
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const titleStyle: React.CSSProperties = {
  margin: '0',
  fontSize: '24px',
  color: '#ffd700',
};

const nameContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
};

const customFormStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '16px',
  width: '100%',
  maxWidth: '600px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '14px',
  color: '#aaa',
};

const fullWidthLabelStyle: React.CSSProperties = {
  ...labelStyle,
  gridColumn: '1 / -1',
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

const chooseDifficultyStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: '14px',
  color: '#8b949e',
};

const presetsContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '12px',
  width: '100%',
  maxWidth: '400px',
};

function presetButtonStyle(
  preset: Exclude<Preset, 'custom'>,
  selected: Preset | null,
  submitting: boolean
): React.CSSProperties {
  const colors: Record<Exclude<Preset, 'custom'>, { border: string; bg: string; text: string }> = {
    easy: { border: '#3fb950', bg: '#1a3d2a', text: '#3fb950' },
    medium: { border: '#ffd700', bg: '#3d3a1a', text: '#ffd700' },
    hard: { border: '#f85149', bg: '#3d1a1a', text: '#f85149' },
  };
  const isSelected = selected === preset;
  const c = colors[preset];

  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px 12px',
    borderRadius: '8px',
    border: isSelected ? `2px solid ${c.border}` : '2px solid #30363d',
    backgroundColor: isSelected ? c.bg : '#161b22',
    color: isSelected ? c.text : '#8b949e',
    fontFamily: 'monospace',
    cursor: submitting ? 'wait' : 'pointer',
    opacity: submitting && selected && selected !== preset ? 0.5 : 1,
    transition: 'all 0.2s',
  };
}

function multiplayerButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px 12px',
    borderRadius: '8px',
    border: '2px solid #58a6ff',
    backgroundColor: '#1a2d4a',
    color: '#58a6ff',
    fontFamily: 'monospace',
    cursor: submitting ? 'wait' : 'pointer',
    transition: 'all 0.2s',
  };
}

function customButtonStyle(submitting: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px 12px',
    borderRadius: '8px',
    border: '2px solid #30363d',
    backgroundColor: '#161b22',
    color: '#8b949e',
    fontFamily: 'monospace',
    cursor: submitting ? 'wait' : 'pointer',
    gridColumn: '1 / -1',
    transition: 'all 0.2s',
  };
}

const presetLabelStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 'bold',
};

const presetDescStyle: React.CSSProperties = {
  fontSize: '11px',
  opacity: 0.8,
  textAlign: 'center',
};

const loadingStyle: React.CSSProperties = {
  margin: '0',
  color: '#8b949e',
  fontSize: '14px',
};

const backButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #30363d',
  backgroundColor: 'transparent',
  color: '#8b949e',
  fontFamily: 'monospace',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const buttonRowStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
};

const browseButtonStyle: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '12px 16px',
  borderRadius: '6px',
  border: '2px solid #58a6ff',
  backgroundColor: 'transparent',
  color: '#58a6ff',
  fontFamily: 'monospace',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
  minHeight: '150px',
};

const charCountStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#666',
};

const resetPromptButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '4px',
  border: '1px solid #555',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '11px',
  cursor: 'pointer',
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: '#e74c3c',
  fontSize: '13px',
};

function submitStyle(enabled: boolean): React.CSSProperties {
  return {
    flex: 1,
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

const groqBadgeLinkStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '16px',
};

const presetBrowseButtonStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  marginTop: '8px',
  padding: '10px 16px',
  borderRadius: '6px',
  border: '1px solid #30363d',
  backgroundColor: 'transparent',
  color: '#8b949e',
  fontFamily: 'monospace',
  fontSize: '13px',
  textDecoration: 'none',
  textAlign: 'center',
};
