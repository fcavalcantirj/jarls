import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

export default function Timer() {
  const gameState = useGameStore((s) => s.gameState);
  const turnTimerMs = gameState?.config.turnTimerMs ?? null;
  const turnNumber = gameState?.turnNumber ?? 0;

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnStartRef = useRef<number>(0);

  // Reset timer on each turn change
  useEffect(() => {
    if (turnTimerMs == null || turnTimerMs <= 0) {
      setRemainingMs(null);
      return;
    }

    turnStartRef.current = Date.now();
    setRemainingMs(turnTimerMs);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - turnStartRef.current;
      const remaining = Math.max(0, turnTimerMs - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0 && intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 100);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [turnTimerMs, turnNumber]);

  if (remainingMs == null) return null;

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;

  const isUrgent = totalSeconds <= 10 && totalSeconds > 0;
  const isExpired = totalSeconds <= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: '#1a1a2e',
        border: `2px solid ${isExpired ? '#555' : isUrgent ? '#e74c3c' : '#555'}`,
        color: isExpired ? '#777' : isUrgent ? '#e74c3c' : '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '18px',
        fontWeight: 'bold',
        animation: isUrgent ? 'timerPulse 0.5s ease-in-out infinite alternate' : undefined,
      }}
    >
      <span style={{ fontSize: '14px', opacity: 0.7 }}>⏱</span>
      <span>{display}</span>
      {isUrgent && (
        <style>{`
          @keyframes timerPulse {
            from { opacity: 1; }
            to { opacity: 0.6; }
          }
        `}</style>
      )}
    </div>
  );
}
