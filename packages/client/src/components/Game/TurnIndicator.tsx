import { useGameStore, selectIsMyTurn, selectCurrentPlayer } from '../../store/gameStore';

export default function TurnIndicator() {
  const isMyTurn = useGameStore(selectIsMyTurn);
  const currentPlayer = useGameStore(selectCurrentPlayer);
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState || !currentPlayer) return null;

  const isAIThinking = currentPlayer.isAI && !isMyTurn;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: '#1a1a2e',
        border: `2px solid ${currentPlayer.color}`,
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '13px',
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
          animation: isAIThinking ? 'pulse 1s ease-in-out infinite' : 'none',
        }}
      />
      <span style={{ fontWeight: 'bold' }}>{currentPlayer.name}</span>
      {isMyTurn && (
        <span
          style={{
            marginLeft: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: '#2ecc71',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
          }}
        >
          Your Turn
        </span>
      )}
      {isAIThinking && (
        <span
          style={{
            marginLeft: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: '#f39c12',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        >
          AI Thinking...
        </span>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
