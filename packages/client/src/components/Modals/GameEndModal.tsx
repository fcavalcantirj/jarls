import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/gameStore';

export default function GameEndModal() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const navigate = useNavigate();

  if (!gameState || gameState.phase !== 'ended' || !gameState.winnerId) return null;

  const isVictory = gameState.winnerId === playerId;
  const winner = gameState.players.find((p) => p.id === gameState.winnerId);
  const winConditionLabel =
    gameState.winCondition === 'throne'
      ? 'Throne Conquest'
      : gameState.winCondition === 'lastStanding'
        ? 'Last Standing'
        : 'Unknown';

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            color: isVictory ? '#f1c40f' : '#e74c3c',
          }}
        >
          {isVictory ? 'Victory!' : 'Defeat'}
        </h2>

        <p style={{ margin: '0 0 4px 0', color: '#e0e0e0', fontSize: '14px' }}>
          {winner ? `${winner.name} wins` : 'Game over'}
        </p>

        <p style={{ margin: '0 0 20px 0', color: '#888', fontSize: '13px' }}>{winConditionLabel}</p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={buttonStyle('#2ecc71')} onClick={() => navigate('/lobby/create')}>
            Play Again
          </button>
          <button style={buttonStyle('#555')} onClick={() => navigate('/')}>
            Leave
          </button>
        </div>
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

function buttonStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 20px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: bg,
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  };
}
