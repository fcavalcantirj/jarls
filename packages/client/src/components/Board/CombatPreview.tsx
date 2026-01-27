import type { CombatResult } from '@jarls/shared';

export interface CombatPreviewProps {
  combat: CombatResult;
  /** Pixel position for tooltip placement */
  x: number;
  y: number;
  /** Viewport dimensions for boundary clamping */
  viewportWidth: number;
  viewportHeight: number;
}

const TOOLTIP_WIDTH = 180;
const TOOLTIP_HEIGHT = 120;
const MARGIN = 12;

function clampPosition(
  x: number,
  y: number,
  vpWidth: number,
  vpHeight: number
): { left: number; top: number } {
  let left = x + MARGIN;
  let top = y + MARGIN;

  if (left + TOOLTIP_WIDTH > vpWidth) {
    left = x - TOOLTIP_WIDTH - MARGIN;
  }
  if (top + TOOLTIP_HEIGHT > vpHeight) {
    top = y - TOOLTIP_HEIGHT - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;
  if (top < MARGIN) top = MARGIN;

  return { left, top };
}

function formatBreakdown(base: number, momentum: number, support: number): string {
  const parts: string[] = [String(base)];
  if (momentum > 0) parts.push(`+${momentum} mom`);
  if (support > 0) parts.push(`+${support} sup`);
  return parts.join(' ');
}

export function CombatPreview({ combat, x, y, viewportWidth, viewportHeight }: CombatPreviewProps) {
  const pos = clampPosition(x, y, viewportWidth, viewportHeight);
  const isPush = combat.outcome === 'push';

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.left,
        top: pos.top,
        width: TOOLTIP_WIDTH,
        background: 'rgba(20, 20, 30, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#fff',
        fontSize: 12,
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 20,
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#f44336' }}>ATK</span>
        <span style={{ fontWeight: 'bold' }}>{combat.attack.total}</span>
      </div>
      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 6 }}>
        {formatBreakdown(combat.attack.baseStrength, combat.attack.momentum, combat.attack.support)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#457b9d' }}>DEF</span>
        <span style={{ fontWeight: 'bold' }}>{combat.defense.total}</span>
      </div>
      <div style={{ color: '#aaa', fontSize: 11, marginBottom: 8 }}>
        {formatBreakdown(combat.defense.baseStrength, 0, combat.defense.support)}
      </div>
      <div
        style={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: 13,
          color: isPush ? '#4caf50' : '#ff9800',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          paddingTop: 6,
        }}
      >
        {isPush ? 'PUSH' : 'BLOCKED'}
      </div>
    </div>
  );
}
