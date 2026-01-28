import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../socket/client';
import type { StarvationCandidates, Piece } from '@jarls/shared';

interface StarvationModalProps {
  candidates: StarvationCandidates | null;
  timeoutMs: number;
}

export default function StarvationModal({ candidates, timeoutMs }: StarvationModalProps) {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeoutMs);

  // Reset state when candidates change
  useEffect(() => {
    setSelectedPieceId(null);
    setSubmitted(false);
    setRemainingMs(timeoutMs);
  }, [candidates, timeoutMs]);

  // Countdown timer
  useEffect(() => {
    if (!candidates || submitted) return;
    const interval = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [candidates, submitted]);

  const handleSubmit = useCallback(() => {
    if (!selectedPieceId || !gameState || submitted) return;
    setSubmitted(true);
    const socket = getSocket();
    socket.emit('starvationChoice', { gameId: gameState.id, pieceId: selectedPieceId }, () => {});
  }, [selectedPieceId, gameState, submitted]);

  if (!candidates || !gameState || !playerId) return null;

  const myCandidates = candidates.find((c) => c.playerId === playerId);
  if (!myCandidates || myCandidates.candidates.length === 0) {
    // Player has no warriors to sacrifice; show waiting message
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <h2 style={titleStyle}>Starvation</h2>
          <p style={descStyle}>Waiting for other players to choose...</p>
        </div>
      </div>
    );
  }

  const remainingSec = Math.ceil(remainingMs / 1000);
  const isUrgent = remainingSec <= 10;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>Starvation</h2>
        <p style={descStyle}>Choose a warrior to sacrifice:</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
          {myCandidates.candidates.map((piece: Piece) => (
            <button
              key={piece.id}
              style={candidateStyle(piece.id === selectedPieceId)}
              onClick={() => !submitted && setSelectedPieceId(piece.id)}
              disabled={submitted}
            >
              Warrior at ({piece.position.q}, {piece.position.r})
            </button>
          ))}
        </div>

        <p style={{ margin: '8px 0', color: isUrgent ? '#e74c3c' : '#888', fontSize: '13px' }}>
          Auto-select in {remainingSec}s
        </p>

        <button
          style={submitStyle(!!selectedPieceId && !submitted)}
          onClick={handleSubmit}
          disabled={!selectedPieceId || submitted}
        >
          {submitted ? 'Submitted' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  border: '2px solid #333',
  borderRadius: '12px',
  padding: '32px 40px',
  textAlign: 'center',
  fontFamily: 'monospace',
  minWidth: '280px',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '24px',
  color: '#e67e22',
};

const descStyle: React.CSSProperties = {
  margin: '0 0 4px 0',
  color: '#e0e0e0',
  fontSize: '14px',
};

function candidateStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: '6px',
    border: selected ? '2px solid #e67e22' : '2px solid #555',
    backgroundColor: selected ? '#2a2a4e' : '#1a1a2e',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    cursor: 'pointer',
  };
}

function submitStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: enabled ? '#e67e22' : '#444',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
  };
}
