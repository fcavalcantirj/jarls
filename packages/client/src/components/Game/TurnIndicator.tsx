import { useState, useEffect } from 'react';
import { useGameStore, selectIsMyTurn, selectCurrentPlayer } from '../../store/gameStore';

function ThinkingDots() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{ display: 'inline-block', width: '24px', textAlign: 'left' }}>
      {'.'.repeat(dotCount)}
    </span>
  );
}

export default function TurnIndicator() {
  const isMyTurn = useGameStore(selectIsMyTurn);
  const currentPlayer = useGameStore(selectCurrentPlayer);
  const gameState = useGameStore((s) => s.gameState);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const pendingTurnUpdate = useGameStore((s) => s.pendingTurnUpdate);

  if (!gameState || !currentPlayer) return null;

  // Check if AI will continue after current animation (momentum)
  const pendingPlayer = pendingTurnUpdate?.newState.players.find(
    (p) => p.id === pendingTurnUpdate.newState.currentPlayerId
  );
  const willAIContinue = pendingPlayer?.isAI === true;

  // Show AI thinking when:
  // 1. Current turn is AI's turn, OR
  // 2. Animation is playing and AI will have another turn (momentum)
  const isAIThinking = (currentPlayer.isAI && !isMyTurn) || (isAnimating && willAIContinue);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '8px',
        backgroundColor: '#1a1a2e',
        border: `2px solid ${currentPlayer.color}`,
        boxShadow: isAIThinking
          ? `0 0 12px ${currentPlayer.color}40, 0 0 24px ${currentPlayer.color}20`
          : 'none',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '13px',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: currentPlayer.color,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: isAIThinking ? `0 0 8px ${currentPlayer.color}` : 'none',
          animation: isAIThinking ? 'glow 1.5s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontWeight: 'bold' }}>{currentPlayer.name}</span>
      {isMyTurn && (
        <span
          style={{
            marginLeft: '4px',
            padding: '3px 10px',
            borderRadius: '4px',
            backgroundColor: '#2ecc71',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
            boxShadow: '0 0 8px #2ecc7180',
          }}
        >
          Your Turn
        </span>
      )}
      {isAIThinking && (
        <span
          style={{
            marginLeft: '4px',
            padding: '3px 10px',
            borderRadius: '4px',
            background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
            boxShadow: '0 0 10px #f39c1280',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          Thinking
          <ThinkingDots />
        </span>
      )}
      <style>{`
        @keyframes glow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
