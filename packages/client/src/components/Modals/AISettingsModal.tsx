import { useState, useCallback, useEffect } from 'react';
import type { GroqModel, GroqDifficulty, AIConfig } from '@jarls/shared';
import { GROQ_MODEL_NAMES, DEFAULT_GROQ_MODEL, DEFAULT_AI_CONFIG } from '@jarls/shared';
import { useGameStore } from '../../store/gameStore';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Partial<AIConfig>) => void;
}

const GROQ_MODELS: GroqModel[] = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'gemma2-9b-it',
];

export default function AISettingsModal({ isOpen, onClose, onSave }: AISettingsModalProps) {
  const aiConfig = useGameStore((s) => s.aiConfig);

  const [model, setModel] = useState<GroqModel>(aiConfig?.model ?? DEFAULT_GROQ_MODEL);
  const [difficulty, setDifficulty] = useState<GroqDifficulty>(
    aiConfig?.difficulty ?? DEFAULT_AI_CONFIG.difficulty
  );
  const [customPrompt, setCustomPrompt] = useState(aiConfig?.customPrompt ?? '');
  const [saving, setSaving] = useState(false);

  // Sync state when aiConfig changes
  useEffect(() => {
    if (aiConfig) {
      setModel(aiConfig.model ?? DEFAULT_GROQ_MODEL);
      setDifficulty(aiConfig.difficulty);
      setCustomPrompt(aiConfig.customPrompt ?? '');
    }
  }, [aiConfig]);

  const handleSave = useCallback(() => {
    setSaving(true);
    const updates: Partial<AIConfig> = {};

    if (aiConfig?.type === 'groq') {
      if (model !== aiConfig.model) updates.model = model;
    }
    if (difficulty !== aiConfig?.difficulty) updates.difficulty = difficulty;
    if (customPrompt.trim() !== (aiConfig?.customPrompt ?? '')) {
      updates.customPrompt = customPrompt.trim() || undefined;
    }

    onSave(updates);
    setSaving(false);
    onClose();
  }, [aiConfig, model, difficulty, customPrompt, onSave, onClose]);

  const handleReset = useCallback(() => {
    setModel(DEFAULT_GROQ_MODEL);
    setDifficulty('intermediate');
    setCustomPrompt('');
  }, []);

  if (!isOpen) return null;

  const isGroq = aiConfig?.type === 'groq';

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>AI Settings</h3>

        {/* Model Selection (only for Groq) */}
        {isGroq && (
          <label style={labelStyle}>
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as GroqModel)}
              style={selectStyle}
            >
              {GROQ_MODELS.map((m) => (
                <option key={m} value={m}>
                  {GROQ_MODEL_NAMES[m]}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Difficulty Selection */}
        <label style={labelStyle}>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as GroqDifficulty)}
            style={selectStyle}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        {/* Custom Prompt (only for Groq) */}
        {isGroq && (
          <label style={labelStyle}>
            Custom Prompt (optional)
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty to use the default prompt for the selected difficulty..."
              style={textareaStyle}
              rows={5}
              maxLength={5000}
            />
            <span style={charCountStyle}>{customPrompt.length}/5000 characters</span>
          </label>
        )}

        {/* Buttons */}
        <div style={buttonRowStyle}>
          <button type="button" style={resetButtonStyle} onClick={handleReset}>
            Reset to Default
          </button>
          <div style={buttonGroupStyle}>
            <button type="button" style={cancelButtonStyle} onClick={onClose}>
              Cancel
            </button>
            <button type="button" style={saveButtonStyle} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Powered by Groq badge */}
        {isGroq && (
          <a
            href="https://groq.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ alignSelf: 'center', marginTop: '12px' }}
          >
            <img
              src="https://console.groq.com/powered-by-groq-dark.svg"
              alt="Powered by Groq for fast inference."
              style={{ height: '20px' }}
            />
          </a>
        )}
      </div>
    </div>
  );
}

/* --- Styles --- */

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  borderRadius: '12px',
  padding: '24px',
  width: '90%',
  maxWidth: '400px',
  maxHeight: '80vh',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  fontFamily: 'monospace',
  color: '#e0e0e0',
  border: '2px solid #333',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '20px',
  color: '#ffd700',
  textAlign: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  color: '#aaa',
};

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#0f0f1a',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '14px',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '6px',
  border: '2px solid #555',
  backgroundColor: '#0f0f1a',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '11px',
  outline: 'none',
  resize: 'vertical',
  minHeight: '80px',
};

const charCountStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#555',
  alignSelf: 'flex-end',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '8px',
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const resetButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '6px',
  border: '1px solid #666',
  backgroundColor: 'transparent',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '12px',
  cursor: 'pointer',
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#444',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#2ecc71',
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: '13px',
  fontWeight: 'bold',
  cursor: 'pointer',
};
