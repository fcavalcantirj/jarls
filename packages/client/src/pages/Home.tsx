import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface GameStats {
  totalGames: number;
  openLobbies: number;
  gamesInProgress: number;
  gamesEnded: number;
}

export default function Home() {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div style={containerStyle}>
      {/* Hero Section */}
      <div style={heroStyle}>
        <h1 style={titleStyle}>
          <span style={titleGradientStyle}>JARLS</span>
        </h1>
        <p style={subtitleStyle}>A Viking Strategy Board Game</p>
        <p style={versionStyle}>v{__APP_VERSION__}</p>
      </div>

      {/* Main Content - Actions + Stats side by side on desktop */}
      <div style={mainContentStyle}>
        {/* Quick Actions */}
        <div style={actionsContainerStyle}>
          <Link to="/lobby/create" style={primaryButtonStyle}>
            <span style={buttonIconStyle}>⚔</span>
            Create Game
          </Link>
          <Link to="/lobby/games" style={secondaryButtonStyle}>
            <span style={buttonIconStyle}>🛡</span>
            Browse Games
            {stats && stats.openLobbies > 0 && <span style={badgeStyle}>{stats.openLobbies}</span>}
          </Link>
          <Link to="/rules" style={tertiaryButtonStyle}>
            <span style={buttonIconStyle}>📜</span>
            Game Rules
          </Link>
        </div>

        {/* Stats Dashboard */}
        <div style={statsContainerStyle}>
          <h3 style={statsHeaderStyle}>Live Activity</h3>
          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <span style={statValueStyle}>{loading ? '...' : (stats?.totalGames ?? 0)}</span>
              <span style={statLabelStyle}>Total Games</span>
            </div>
            <div style={statCardStyle}>
              <span style={statValueStyle}>{loading ? '...' : (stats?.openLobbies ?? 0)}</span>
              <span style={statLabelStyle}>Open Lobbies</span>
            </div>
            <div style={statCardStyle}>
              <span style={statValueStyle}>{loading ? '...' : (stats?.gamesInProgress ?? 0)}</span>
              <span style={statLabelStyle}>In Progress</span>
            </div>
          </div>
        </div>
      </div>

      {/* Game Modes */}
      <div style={modesContainerStyle}>
        <div style={modeCardStyle}>
          <span style={modeIconStyle}>👥</span>
          <span style={modeLabelStyle}>Human vs Human</span>
        </div>
        <div style={modeCardStyle}>
          <span style={modeIconStyle}>🤖</span>
          <span style={modeLabelStyle}>Human vs AI</span>
        </div>
        <div style={modeCardStyle}>
          <span style={modeIconStyle}>⚔️</span>
          <span style={modeLabelStyle}>Mixed Battle</span>
        </div>
      </div>
      <p style={modeSubtextStyle}>2-4 players • Multiple AI models • Lightning fast</p>

      {/* Game Description */}
      <div style={descriptionStyle}>
        <p style={taglineStyle}>
          Inspired by <span style={termJarlStyle}>Hnefatafl</span> — the ancient Viking board game
        </p>
      </div>
      <div style={featuresStyle}>
        <p style={featureTextStyle}>
          Your <span style={termJarlStyle}>Jarl</span> leads. Your{' '}
          <span style={termWarriorStyle}>warriors</span> fight. The board is unforgiving.
        </p>
        <p style={featureTextStyle}>
          Push enemies into <span style={termHoleStyle}>the void</span>. Seize the{' '}
          <span style={termThroneStyle}>throne</span>. There is no retreat.
        </p>
        <Link to="/rules" style={rulesLinkStyle}>
          Learn the rules →
        </Link>
      </div>

      {/* Powered by Groq Badge */}
      <a href="https://groq.com" target="_blank" rel="noopener noreferrer" style={groqBadgeStyle}>
        <img
          src="https://console.groq.com/powered-by-groq-dark.svg"
          alt="Powered by Groq for fast inference."
          style={groqBadgeImgStyle}
        />
      </a>
    </div>
  );
}

/* --- Styles --- */

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '20px 20px 32px',
  paddingTop: 'max(20px, env(safe-area-inset-top))',
  paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
  background: 'linear-gradient(180deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
  color: '#e0e0e0',
  fontFamily: 'monospace',
  gap: '16px',
  overflowY: 'auto',
  minHeight: 0,
};

const heroStyle: React.CSSProperties = {
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(2rem, 8vw, 4rem)',
  margin: 0,
  letterSpacing: '0.2em',
  textShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
};

const titleGradientStyle: React.CSSProperties = {
  background:
    'linear-gradient(135deg, #ffd700 0%, #ff8c00 25%, #ffd700 50%, #ffa500 75%, #ffd700 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#8b949e',
  margin: '4px 0 2px 0',
  letterSpacing: '0.08em',
};

const versionStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#484f58',
};

const mainContentStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '24px',
  width: '100%',
  maxWidth: '900px',
};

const actionsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  width: '100%',
  minWidth: '280px',
  maxWidth: '360px',
  flex: '1 1 300px',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '16px 32px',
  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
  color: '#0d1117',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '1.1rem',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  transition: 'transform 0.2s, box-shadow 0.2s',
  boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '14px 32px',
  background: 'transparent',
  color: '#ffd700',
  textDecoration: 'none',
  borderRadius: '8px',
  border: '2px solid #ffd70055',
  fontSize: '1rem',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  transition: 'background 0.2s, border-color 0.2s',
  position: 'relative',
};

const tertiaryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '10px 32px',
  background: 'transparent',
  color: '#8b949e',
  textDecoration: 'none',
  borderRadius: '8px',
  border: '1px solid #30363d',
  fontSize: '0.9rem',
  fontFamily: 'monospace',
  transition: 'background 0.2s, color 0.2s',
};

const buttonIconStyle: React.CSSProperties = {
  fontSize: '1.2rem',
};

const badgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-8px',
  right: '-8px',
  background: '#238636',
  color: '#fff',
  fontSize: '0.75rem',
  padding: '2px 8px',
  borderRadius: '12px',
  fontWeight: 'bold',
};

const statsContainerStyle: React.CSSProperties = {
  width: '100%',
  minWidth: '280px',
  maxWidth: '360px',
  flex: '1 1 300px',
  padding: '12px 20px',
  background: 'rgba(22, 27, 34, 0.8)',
  borderRadius: '10px',
  border: '1px solid #30363d',
};

const statsHeaderStyle: React.CSSProperties = {
  margin: '0 0 6px 0',
  fontSize: '0.7rem',
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  textAlign: 'center',
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
};

const statCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px 4px',
  background: 'rgba(13, 17, 23, 0.6)',
  borderRadius: '8px',
  border: '1px solid #21262d',
};

const statValueStyle: React.CSSProperties = {
  fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
  fontWeight: 'bold',
  background: 'linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#8b949e',
  marginTop: '4px',
  textAlign: 'center',
};

const modesContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '16px',
  width: '100%',
  maxWidth: '600px',
};

const modeCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '12px 24px',
  background: 'rgba(88, 166, 255, 0.1)',
  borderRadius: '8px',
  border: '1px solid rgba(88, 166, 255, 0.2)',
};

const modeIconStyle: React.CSSProperties = {
  fontSize: '1.5rem',
};

const modeLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#58a6ff',
  fontWeight: 'bold',
};

const modeSubtextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: '#8b949e',
  whiteSpace: 'nowrap',
};

const descriptionStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '8px 24px',
  width: '100%',
  maxWidth: '900px',
  textAlign: 'center',
  padding: '4px 0',
};

const taglineStyle: React.CSSProperties = {
  margin: 0,
  color: '#8b949e',
  fontSize: '0.9rem',
  fontStyle: 'italic',
  whiteSpace: 'nowrap',
};

const featuresStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '100%',
  maxWidth: '600px',
  textAlign: 'center',
};

const featureTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#c9d1d9',
  fontSize: '1rem',
  lineHeight: '1.5',
  whiteSpace: 'nowrap',
};

const rulesLinkStyle: React.CSSProperties = {
  color: '#58a6ff',
  textDecoration: 'none',
  fontSize: '0.9rem',
  marginTop: '4px',
};

const termJarlStyle: React.CSSProperties = {
  color: '#ffd700',
  fontWeight: 'bold',
};

const termWarriorStyle: React.CSSProperties = {
  color: '#58a6ff',
  fontWeight: 'bold',
};

const termHoleStyle: React.CSSProperties = {
  color: '#f85149',
  fontWeight: 'bold',
};

const termThroneStyle: React.CSSProperties = {
  color: '#ffc107',
  fontWeight: 'bold',
};

const groqBadgeStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '16px',
  opacity: 0.7,
  transition: 'opacity 0.2s',
};

const groqBadgeImgStyle: React.CSSProperties = {
  height: '28px',
  maxWidth: '100%',
};
