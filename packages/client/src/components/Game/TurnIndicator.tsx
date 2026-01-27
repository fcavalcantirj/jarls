import { useGameStore, selectIsMyTurn, selectCurrentPlayer } from '../../store/gameStore';

export default function TurnIndicator() {
  const isMyTurn = useGameStore(selectIsMyTurn);
  const currentPlayer = useGameStore(selectCurrentPlayer);
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState || !currentPlayer) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: '#1a1a2e',
        border: `2px solid ${currentPlayer.color}`,
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: '14px',
      }}
    >
      <span
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: currentPlayer.color,
          display: 'inline-block',
          flexShrink: 0,
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
    </div>
  );
}
