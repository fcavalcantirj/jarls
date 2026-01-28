import { useState } from 'react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'rules' | 'combat' | 'special';

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const [tab, setTab] = useState<Tab>('rules');

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#f1c40f' }}>How to Play</h2>
          <button style={closeButtonStyle} onClick={onClose}>
            X
          </button>
        </div>

        {/* Tabs */}
        <div style={tabBarStyle}>
          <TabButton label="Rules" active={tab === 'rules'} onClick={() => setTab('rules')} />
          <TabButton label="Combat" active={tab === 'combat'} onClick={() => setTab('combat')} />
          <TabButton label="Special" active={tab === 'special'} onClick={() => setTab('special')} />
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {tab === 'rules' && <RulesContent />}
          {tab === 'combat' && <CombatContent />}
          {tab === 'special' && <SpecialContent />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      style={{
        ...tabStyle,
        backgroundColor: active ? '#333' : 'transparent',
        color: active ? '#f1c40f' : '#888',
        borderBottom: active ? '2px solid #f1c40f' : '2px solid transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RulesContent() {
  return (
    <>
      <Section title="Objective">
        Move your Jarl to the central Throne hex to win instantly, or be the last Jarl standing.
      </Section>

      <Section title="Pieces">
        <Row label="Jarl" value="Strength 2. Moves 1 hex (or 2 with draft formation)." />
        <Row label="Warrior" value="Strength 1. Moves 1-2 hexes in a straight line." />
        <Row label="Shield" value="Immovable obstacle. Blocks movement and pushes." />
      </Section>

      <Section title="Movement">
        Pieces move in straight lines along hex directions. The path must be clear of all pieces
        (friendly or enemy). Moving into an enemy-occupied hex initiates combat.
      </Section>

      <Section title="Turns">
        Players alternate turns. You must move one piece per turn (no passing unless completely
        blocked). The first player rotates each round.
      </Section>
    </>
  );
}

function CombatContent() {
  return (
    <>
      <Section title="Attack Calculation">
        <Row label="Base" value="Piece strength (Jarl=2, Warrior=1)" />
        <Row label="Momentum" value="+1 if moved 2 hexes before contact" />
        <Row
          label="Inline Support"
          value="+strength of each friendly piece directly behind attacker"
        />
      </Section>

      <Section title="Defense Calculation">
        <Row label="Base" value="Piece strength (Jarl=2, Warrior=1)" />
        <Row
          label="Bracing"
          value="+strength of each friendly piece directly behind defender (opposite push direction)"
        />
      </Section>

      <Section title="Outcome">
        <Row
          label="Attack > Defense"
          value="Push: defender is pushed one hex in the attack direction"
        />
        <Row label="Attack <= Defense" value="Blocked: attacker stops adjacent to defender" />
      </Section>

      <Section title="Push Chains">
        If the hex behind a pushed piece contains another piece, the entire chain pushes together.
        Pieces pushed off the board edge are eliminated. Chains compress against Shields and the
        Throne (Warriors cannot enter the Throne).
      </Section>
    </>
  );
}

function SpecialContent() {
  return (
    <>
      <Section title="Draft Formation">
        A Jarl can move 2 hexes if there are 2+ friendly Warriors in a line directly behind it (in
        any of the 6 hex directions). This enables the Jarl&apos;s momentum bonus.
      </Section>

      <Section title="Throne">
        The center hex (0,0). Only Jarls can voluntarily enter it. Warriors pushed toward the Throne
        compress against it like a Shield. A Jarl crossing the Throne during a 2-hex move stops
        there and wins immediately.
      </Section>

      <Section title="Starvation">
        After 10 rounds without any elimination, each player must sacrifice their Warrior furthest
        from the Throne. This repeats every 5 rounds. If a player has no Warriors for 5 rounds,
        their Jarl is eliminated.
      </Section>

      <Section title="Elimination">
        A player is eliminated when their Jarl is pushed off the board edge. All their remaining
        Warriors are removed. The last Jarl standing wins.
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#f1c40f' }}>{title}</h3>
      <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5' }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{label}: </span>
      <span>{value}</span>
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
  padding: '24px',
  fontFamily: 'monospace',
  maxWidth: '480px',
  width: '90vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #555',
  borderRadius: '4px',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: '14px',
  cursor: 'pointer',
  padding: '4px 8px',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  marginBottom: '16px',
  borderBottom: '1px solid #333',
};

const tabStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
  fontWeight: 'bold',
};

const contentStyle: React.CSSProperties = {
  overflowY: 'auto',
  flex: 1,
};
