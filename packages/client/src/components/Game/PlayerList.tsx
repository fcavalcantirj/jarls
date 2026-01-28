import React from 'react';
import { useGameStore, selectCurrentPlayer } from '../../store/gameStore';
import type { Player, Piece } from '@jarls/shared';

/** Count warriors for a given player */
function countWarriors(pieces: Piece[], playerId: string): number {
  return pieces.filter((p) => p.playerId === playerId && p.type === 'warrior').length;
}

/** Check if a player's Jarl is still alive */
function hasJarl(pieces: Piece[], playerId: string): boolean {
  return pieces.some((p) => p.playerId === playerId && p.type === 'jarl');
}

const PlayerList: React.FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const currentPlayer = useGameStore(selectCurrentPlayer);

  if (!gameState) return null;

  const { players, pieces } = gameState;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Players</div>
      {players.map((player) => {
        const warriors = countWarriors(pieces, player.id);
        const jarlAlive = hasJarl(pieces, player.id);
        const isCurrent = currentPlayer?.id === player.id;

        return (
          <PlayerRow
            key={player.id}
            player={player}
            warriors={warriors}
            jarlAlive={jarlAlive}
            isCurrent={isCurrent}
          />
        );
      })}
    </div>
  );
};

interface PlayerRowProps {
  player: Player;
  warriors: number;
  jarlAlive: boolean;
  isCurrent: boolean;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, warriors, jarlAlive, isCurrent }) => {
  const nameStyle: React.CSSProperties = {
    fontWeight: 'bold',
    color: player.isEliminated ? '#666' : '#e0e0e0',
    textDecoration: player.isEliminated ? 'line-through' : 'none',
  };

  return (
    <div
      style={{
        ...rowStyle,
        borderLeft: isCurrent ? `3px solid ${player.color}` : '3px solid transparent',
        opacity: player.isEliminated ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: player.color,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={nameStyle}>{player.name}</span>
      </div>
      <div style={statsStyle}>
        {jarlAlive ? (
          <span style={{ color: '#ffd700', fontSize: '12px' }} title="Jarl alive">
            J
          </span>
        ) : (
          <span style={{ color: '#666', fontSize: '12px' }} title="Jarl eliminated">
            -
          </span>
        )}
        <span style={{ color: '#aaa', fontSize: '12px' }} title={`${warriors} warriors`}>
          W:{warriors}
        </span>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  background: '#1a1a2e',
  borderRadius: '8px',
  padding: '12px',
  fontFamily: 'monospace',
};

const headerStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '8px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: '4px',
  marginBottom: '4px',
};

const statsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
};

export default PlayerList;
