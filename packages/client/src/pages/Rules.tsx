import { Link } from 'react-router-dom';

export default function Rules() {
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>Game Rules</h1>
        <Link to="/" style={backLinkStyle}>
          ← Back to Home
        </Link>
      </div>

      {/* Victory Conditions */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Victory Conditions</h2>
        <div style={cardStyle}>
          <div style={ruleItemStyle}>
            <span style={termThroneStyle}>Throne Victory</span>
            <p style={ruleTextStyle}>
              Move your <span style={termJarlStyle}>Jarl</span> to the{' '}
              <span style={termThroneStyle}>throne</span> at the center of the board (0,0) —{' '}
              <span style={termVictoryStyle}>INSTANT WIN!</span>
            </p>
          </div>
          <div style={ruleItemStyle}>
            <span style={termVictoryStyle}>Elimination Victory</span>
            <p style={ruleTextStyle}>
              Eliminate the enemy <span style={termJarlStyle}>Jarl</span> by pushing it off the
              board edge or into a <span style={termHoleStyle}>hole</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Pieces */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Pieces</h2>
        <div style={cardStyle}>
          <div style={pieceRowStyle}>
            <div style={pieceIconStyle}>👑</div>
            <div>
              <span style={termJarlStyle}>Jarl (King)</span>
              <p style={ruleTextStyle}>
                Your most important piece. <strong>Strength 2</strong>. Can move 1-2 hexes. Protect
                it at all costs — if your Jarl is eliminated, you lose!
              </p>
            </div>
          </div>
          <div style={pieceRowStyle}>
            <div style={pieceIconStyle}>⚔</div>
            <div>
              <span style={termWarriorStyle}>Warrior</span>
              <p style={ruleTextStyle}>
                Your fighting force. <strong>Strength 1</strong>. Can move exactly 1 hex. Use them
                to support attacks and defend your Jarl.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Movement */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Movement</h2>
        <div style={cardStyle}>
          <ul style={listStyle}>
            <li>
              <span style={termWarriorStyle}>Warriors</span> move exactly <strong>1 hex</strong> in
              any direction
            </li>
            <li>
              <span style={termJarlStyle}>Jarls</span> can move <strong>1 hex</strong> normally
            </li>
            <li>
              <span style={termJarlStyle}>Jarls</span> can move <strong>2 hexes</strong> with{' '}
              <em>"Draft Formation"</em> — 2+ friendly pieces directly behind in movement direction
            </li>
            <li>
              Moving 2 hexes grants <span style={termMomentumStyle}>Momentum</span> (+1 attack
              strength)
            </li>
            <li>
              If a <span style={termJarlStyle}>Jarl's</span> 2-hex move crosses the{' '}
              <span style={termThroneStyle}>throne</span>, it stops there and{' '}
              <span style={termVictoryStyle}>wins!</span>
            </li>
            <li>
              <strong>Cannot</strong> move onto or through <span style={termHoleStyle}>holes</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Combat */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Combat (Pushing)</h2>
        <div style={cardStyle}>
          <ul style={listStyle}>
            <li>Moving into an occupied hex initiates combat</li>
            <li>You cannot attack your own pieces</li>
            <li>
              <strong>Attack</strong> = piece strength +{' '}
              <span style={termMomentumStyle}>momentum</span> + inline support
            </li>
            <li>
              <strong>Defense</strong> = piece strength + bracing support
            </li>
            <li>
              If attack {'>'} defense: defender is <strong>PUSHED</strong> one hex away
            </li>
            <li>If attack ≤ defense: push is blocked, attacker stays in place</li>
          </ul>
          <div style={subSectionStyle}>
            <h4 style={subTitleStyle}>Support Mechanics</h4>
            <ul style={listStyle}>
              <li>
                <strong>Inline Support (attack):</strong> Friendly pieces directly behind the
                attacker add their strength
              </li>
              <li>
                <strong>Bracing (defense):</strong> Friendly pieces behind the defender (opposite to
                push direction) add their strength
              </li>
            </ul>
          </div>
          <div style={subSectionStyle}>
            <h4 style={subTitleStyle}>Push Chains</h4>
            <ul style={listStyle}>
              <li>
                If a pushed piece hits another piece, it pushes that piece too (chain reaction)
              </li>
              <li>
                Chains end at: board edge (elimination), <span style={termHoleStyle}>hole</span>{' '}
                (elimination), or empty hex
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Holes */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          <span style={termHoleStyle}>Holes</span> (Deadly Pits)
        </h2>
        <div style={{ ...cardStyle, borderColor: '#8b0000' }}>
          <ul style={listStyle}>
            <li>
              <span style={termHoleStyle}>Holes</span> are hazards on the board that pieces cannot
              move onto or through
            </li>
            <li>
              Pieces pushed into <span style={termHoleStyle}>holes</span> are{' '}
              <strong>ELIMINATED</strong> instantly
            </li>
            <li>
              <strong>Strategic tip:</strong> Push enemies toward{' '}
              <span style={termHoleStyle}>holes</span> for elimination!
            </li>
            <li>
              <strong>Warning:</strong> Don't position your pieces where they can be pushed into{' '}
              <span style={termHoleStyle}>holes</span>
            </li>
          </ul>
          <div style={terrainBoxStyle}>
            <h4 style={subTitleStyle}>Terrain Types (Hole Count)</h4>
            <div style={terrainGridStyle}>
              <div style={terrainItemStyle}>
                <span style={terrainNameStyle}>Calm</span>
                <span style={terrainCountStyle}>3 holes</span>
              </div>
              <div style={terrainItemStyle}>
                <span style={terrainNameStyle}>Treacherous</span>
                <span style={terrainCountStyle}>6 holes</span>
              </div>
              <div style={terrainItemStyle}>
                <span style={terrainNameStyle}>Chaotic</span>
                <span style={terrainCountStyle}>9 holes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Board */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>The Board</h2>
        <div style={cardStyle}>
          <ul style={listStyle}>
            <li>
              Hexagonal grid with <span style={termThroneStyle}>throne</span> at center (0,0)
            </li>
            <li>Board radius defines how far from center pieces can be</li>
            <li>Hexes at maximum radius are "edge" hexes — pieces can be pushed off from there</li>
            <li>
              <span style={termHoleStyle}>Holes</span> are randomly placed based on terrain type
            </li>
          </ul>
        </div>
      </section>

      {/* Play Now CTA */}
      <div style={ctaContainerStyle}>
        <Link to="/lobby/create" style={ctaButtonStyle}>
          Ready to Play?
        </Link>
      </div>
    </div>
  );
}

/* --- Styles --- */

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: 'var(--padding-page)',
  paddingTop: '24px',
  paddingBottom: '48px',
  background: 'linear-gradient(180deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
  color: '#e0e0e0',
  fontFamily: 'monospace',
  maxWidth: '800px',
  margin: '0 auto',
  gap: '24px',
  overflow: 'auto',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
  margin: 0,
  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const backLinkStyle: React.CSSProperties = {
  color: '#8b949e',
  textDecoration: 'none',
  fontSize: '0.9rem',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  margin: 0,
  color: '#ffd700',
  borderBottom: '1px solid #30363d',
  paddingBottom: '8px',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(22, 27, 34, 0.8)',
  borderRadius: '12px',
  border: '1px solid #30363d',
  padding: '16px',
};

const ruleItemStyle: React.CSSProperties = {
  marginBottom: '12px',
};

const ruleTextStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  color: '#c9d1d9',
  lineHeight: '1.5',
};

const pieceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '16px',
};

const pieceIconStyle: React.CSSProperties = {
  fontSize: '2rem',
  minWidth: '48px',
  textAlign: 'center',
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  lineHeight: '1.8',
  color: '#c9d1d9',
};

const subSectionStyle: React.CSSProperties = {
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid #21262d',
};

const subTitleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '0.95rem',
  color: '#8b949e',
};

const terrainBoxStyle: React.CSSProperties = {
  marginTop: '16px',
  paddingTop: '12px',
  borderTop: '1px solid #21262d',
};

const terrainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  marginTop: '8px',
};

const terrainItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '8px',
  background: 'rgba(13, 17, 23, 0.6)',
  borderRadius: '8px',
  border: '1px solid #21262d',
};

const terrainNameStyle: React.CSSProperties = {
  color: '#e0e0e0',
  fontWeight: 'bold',
};

const terrainCountStyle: React.CSSProperties = {
  color: '#8b949e',
  fontSize: '0.85rem',
};

const ctaContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginTop: '16px',
};

const ctaButtonStyle: React.CSSProperties = {
  padding: '14px 32px',
  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
  color: '#0d1117',
  textDecoration: 'none',
  borderRadius: '8px',
  fontSize: '1.1rem',
  fontFamily: 'monospace',
  fontWeight: 'bold',
  boxShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
};

/* --- Term Colors --- */

const termJarlStyle: React.CSSProperties = {
  color: '#ffd700',
  fontWeight: 'bold',
};

const termWarriorStyle: React.CSSProperties = {
  color: '#58a6ff',
  fontWeight: 'bold',
};

const termThroneStyle: React.CSSProperties = {
  color: '#ffc107',
  fontWeight: 'bold',
};

const termHoleStyle: React.CSSProperties = {
  color: '#f85149',
  fontWeight: 'bold',
};

const termVictoryStyle: React.CSSProperties = {
  color: '#3fb950',
  fontWeight: 'bold',
};

const termMomentumStyle: React.CSSProperties = {
  color: '#a371f7',
  fontWeight: 'bold',
};
