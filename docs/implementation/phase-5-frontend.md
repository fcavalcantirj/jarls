# Phase 5: Frontend (Web Client)

## Overview

Implement the web-based game client with hex grid rendering, input handling, and real-time updates.

**Prerequisites:** Phase 3 complete (Phase 4 optional)
**Estimated Effort:** 5-7 days
**Package:** `@jarls/client`

---

## Task 5.1: Hex Grid Rendering

### Description
Render the game board using honeycomb-grid and Canvas/SVG.

### Work Items
- [ ] Set up Vite + TypeScript project
- [ ] Install honeycomb-grid
- [ ] Create `BoardRenderer` class
- [ ] Render hexagonal board with correct radius
- [ ] Render hex grid lines
- [ ] Render Throne (center hex)
- [ ] Render Shields
- [ ] Render pieces (Jarls and Warriors)
- [ ] Handle board scaling to viewport
- [ ] Implement smooth 60fps rendering

### Tech Choices
- **Rendering:** Canvas for performance (PixiJS optional for effects)
- **Hex Library:** honeycomb-grid for coordinate math
- **State Management:** Simple store or Zustand

### Board Renderer
```typescript
import { defineHex, Grid, Orientation } from 'honeycomb-grid';
import { GameState, Piece, AxialCoord } from '@jarls/shared';

interface RenderConfig {
  hexSize: number;
  colors: {
    board: string;
    hexBorder: string;
    throne: string;
    shield: string;
    players: string[];
  };
}

const DEFAULT_CONFIG: RenderConfig = {
  hexSize: 40,
  colors: {
    board: '#2d3436',
    hexBorder: '#636e72',
    throne: '#ffd700',
    shield: '#7f8c8d',
    players: ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c']
  }
};

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: Grid<Hex>;
  private config: RenderConfig;

  constructor(canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set up hex definition
    const Hex = defineHex({
      dimensions: this.config.hexSize,
      orientation: Orientation.POINTY
    });

    // Grid will be set when rendering state
    this.grid = new Grid(Hex, []);
  }

  render(state: GameState, highlights?: RenderHighlights): void {
    const { ctx, config } = this;
    const { width, height } = this.canvas;

    // Clear
    ctx.fillStyle = config.colors.board;
    ctx.fillRect(0, 0, width, height);

    // Calculate center offset
    const centerX = width / 2;
    const centerY = height / 2;

    // Render board hexes
    this.renderBoardHexes(state, centerX, centerY);

    // Render highlights (valid moves, selected, etc.)
    if (highlights) {
      this.renderHighlights(highlights, centerX, centerY);
    }

    // Render throne
    this.renderThrone(centerX, centerY);

    // Render shields
    state.pieces
      .filter(p => p.type === 'shield')
      .forEach(shield => this.renderShield(shield, centerX, centerY));

    // Render pieces
    state.pieces
      .filter(p => p.type !== 'shield')
      .forEach(piece => this.renderPiece(piece, state, centerX, centerY));
  }

  private renderBoardHexes(state: GameState, centerX: number, centerY: number): void {
    const { ctx, config } = this;
    const radius = state.config.boardRadius;

    // Generate all valid hexes
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        const s = -q - r;
        if (Math.abs(s) > radius) continue;

        const pixel = this.hexToPixel({ q, r }, centerX, centerY);

        // Draw hex outline
        ctx.beginPath();
        this.drawHexPath(pixel.x, pixel.y);
        ctx.strokeStyle = config.colors.hexBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  private renderThrone(centerX: number, centerY: number): void {
    const { ctx, config } = this;
    const pixel = this.hexToPixel({ q: 0, r: 0 }, centerX, centerY);

    ctx.beginPath();
    this.drawHexPath(pixel.x, pixel.y);
    ctx.fillStyle = config.colors.throne;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Crown icon
    ctx.font = `${config.hexSize * 0.6}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = config.colors.throne;
    ctx.fillText('👑', pixel.x, pixel.y);
  }

  private renderShield(shield: Piece, centerX: number, centerY: number): void {
    const { ctx, config } = this;
    const pixel = this.hexToPixel(shield.position, centerX, centerY);

    ctx.beginPath();
    this.drawHexPath(pixel.x, pixel.y);
    ctx.fillStyle = config.colors.shield;
    ctx.fill();

    // Shield icon
    ctx.font = `${config.hexSize * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', pixel.x, pixel.y);
  }

  private renderPiece(piece: Piece, state: GameState, centerX: number, centerY: number): void {
    const { ctx, config } = this;
    const pixel = this.hexToPixel(piece.position, centerX, centerY);

    // Get player color
    const playerIndex = state.players.findIndex(p => p.id === piece.owner);
    const color = config.colors.players[playerIndex] || '#ffffff';

    // Draw piece
    ctx.beginPath();
    const radius = piece.type === 'jarl'
      ? config.hexSize * 0.45
      : config.hexSize * 0.3;
    ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Jarl crown indicator
    if (piece.type === 'jarl') {
      ctx.font = `${config.hexSize * 0.3}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('♔', pixel.x, pixel.y);
    }
  }

  private renderHighlights(highlights: RenderHighlights, centerX: number, centerY: number): void {
    const { ctx, config } = this;

    // Selected piece
    if (highlights.selected) {
      const pixel = this.hexToPixel(highlights.selected, centerX, centerY);
      ctx.beginPath();
      this.drawHexPath(pixel.x, pixel.y);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Valid moves
    highlights.validMoves?.forEach(move => {
      const pixel = this.hexToPixel(move.to, centerX, centerY);
      ctx.beginPath();
      this.drawHexPath(pixel.x, pixel.y);

      if (move.type === 'attack') {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.4)'; // Red for attack
      } else {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.4)'; // Green for move
      }
      ctx.fill();

      // Momentum indicator
      if (move.hasMomentum) {
        ctx.font = `${config.hexSize * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('⚡', pixel.x, pixel.y - config.hexSize * 0.3);
      }
    });
  }

  private hexToPixel(hex: AxialCoord, centerX: number, centerY: number): { x: number; y: number } {
    const size = this.config.hexSize;
    const x = centerX + size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
    const y = centerY + size * (3 / 2 * hex.r);
    return { x, y };
  }

  pixelToHex(x: number, y: number, centerX: number, centerY: number): AxialCoord {
    const size = this.config.hexSize;
    const px = x - centerX;
    const py = y - centerY;

    const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / size;
    const r = (2 / 3 * py) / size;

    return this.roundHex(q, r);
  }

  private roundHex(q: number, r: number): AxialCoord {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - s);

    if (qDiff > rDiff && qDiff > sDiff) {
      rq = -rr - rs;
    } else if (rDiff > sDiff) {
      rr = -rq - rs;
    }

    return { q: rq, r: rr };
  }

  private drawHexPath(x: number, y: number): void {
    const { ctx, config } = this;
    const size = config.hexSize;

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = x + size * Math.cos(angle);
      const hy = y + size * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }
}

interface RenderHighlights {
  selected?: AxialCoord;
  validMoves?: ValidMove[];
  lastMove?: { from: AxialCoord; to: AxialCoord };
}
```

### Definition of Done
- [ ] Board renders correctly for all player counts (2-6)
- [ ] Pieces are visually distinguishable by player
- [ ] Jarls are visually distinct from Warriors
- [ ] Throne and Shields clearly visible
- [ ] Board scales responsively
- [ ] Smooth 60fps rendering

### Test Cases
```typescript
// Visual regression tests with screenshots
describe('Board Rendering', () => {
  test('renders 2-player board correctly', async () => {
    const canvas = createTestCanvas(800, 600);
    const renderer = new BoardRenderer(canvas);
    const state = createTestState(2);

    renderer.render(state);

    await expect(canvas).toMatchImageSnapshot();
  });

  test('renders 6-player board correctly', async () => {
    const canvas = createTestCanvas(800, 600);
    const renderer = new BoardRenderer(canvas);
    const state = createTestState(6);

    renderer.render(state);

    await expect(canvas).toMatchImageSnapshot();
  });

  test('pixel to hex conversion is accurate', () => {
    const renderer = new BoardRenderer(createTestCanvas(800, 600));

    // Center should be 0,0
    const center = renderer.pixelToHex(400, 300, 400, 300);
    expect(center).toEqual({ q: 0, r: 0 });
  });
});
```

---

## Task 5.2: Input Handling

### Description
Handle player input for piece selection and move execution.

### Work Items
- [ ] Implement click/tap detection
- [ ] Implement piece selection
- [ ] Implement destination selection
- [ ] Show valid moves on selection
- [ ] Show combat preview on hover
- [ ] Handle touch input for mobile
- [ ] Implement drag-and-drop (optional)

### Input Handler
```typescript
export class InputHandler {
  private renderer: BoardRenderer;
  private socket: Socket;
  private selectedPiece: string | null = null;
  private validMoves: ValidMove[] = [];
  private state: GameState | null = null;
  private playerId: string;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: BoardRenderer,
    socket: Socket,
    playerId: string
  ) {
    this.renderer = renderer;
    this.socket = socket;
    this.playerId = playerId;

    canvas.addEventListener('click', this.handleClick.bind(this));
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    canvas.addEventListener('touchstart', this.handleTouch.bind(this));
  }

  setState(state: GameState): void {
    this.state = state;

    // Clear selection if not our turn
    if (!this.isMyTurn()) {
      this.clearSelection();
    }
  }

  private handleClick(event: MouseEvent): void {
    if (!this.state || !this.isMyTurn()) return;

    const hex = this.getHexFromEvent(event);
    if (!hex) return;

    // Check if clicking on valid move destination
    if (this.selectedPiece) {
      const move = this.validMoves.find(
        m => m.to.q === hex.q && m.to.r === hex.r
      );

      if (move) {
        this.executeMove(move);
        return;
      }
    }

    // Check if clicking on own piece
    const piece = this.getPieceAt(hex);
    if (piece && piece.owner === this.playerId) {
      this.selectPiece(piece.id);
    } else {
      this.clearSelection();
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.state || !this.selectedPiece) return;

    const hex = this.getHexFromEvent(event);
    if (!hex) return;

    const move = this.validMoves.find(
      m => m.to.q === hex.q && m.to.r === hex.r
    );

    // Update hover state for combat preview
    if (move?.combat) {
      this.showCombatPreview(move);
    } else {
      this.hideCombatPreview();
    }
  }

  private handleTouch(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.handleClick(mouseEvent);
  }

  private selectPiece(pieceId: string): void {
    this.selectedPiece = pieceId;

    // Fetch valid moves from server
    this.socket.emit('getValidMoves', { pieceId }, (response) => {
      if (response.success) {
        this.validMoves = response.moves;
        this.updateHighlights();
      }
    });
  }

  private clearSelection(): void {
    this.selectedPiece = null;
    this.validMoves = [];
    this.updateHighlights();
  }

  private executeMove(move: ValidMove): void {
    const command: MoveCommand = {
      pieceId: this.selectedPiece!,
      to: move.to
    };

    this.socket.emit('playTurn', { command }, (response) => {
      if (response.success) {
        this.clearSelection();
      } else {
        console.error('Move failed:', response.error);
        // Show error toast
      }
    });
  }

  private isMyTurn(): boolean {
    if (!this.state) return false;
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    return currentPlayer?.id === this.playerId;
  }

  private getPieceAt(hex: AxialCoord): Piece | undefined {
    return this.state?.pieces.find(
      p => p.position.q === hex.q && p.position.r === hex.r
    );
  }

  private getHexFromEvent(event: MouseEvent): AxialCoord | null {
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    return this.renderer.pixelToHex(x, y, centerX, centerY);
  }

  private updateHighlights(): void {
    const selected = this.selectedPiece
      ? this.state?.pieces.find(p => p.id === this.selectedPiece)?.position
      : undefined;

    this.renderer.render(this.state!, {
      selected,
      validMoves: this.validMoves
    });
  }

  private showCombatPreview(move: ValidMove): void {
    // Update UI to show combat preview
    // This could be a tooltip or overlay
    const event = new CustomEvent('combatPreview', { detail: move.combat });
    document.dispatchEvent(event);
  }

  private hideCombatPreview(): void {
    const event = new CustomEvent('combatPreview', { detail: null });
    document.dispatchEvent(event);
  }
}
```

### Definition of Done
- [ ] Piece selection works with click/tap
- [ ] Valid moves highlight on selection
- [ ] Clicking destination executes move
- [ ] Combat preview shown on hover
- [ ] Touch input works on mobile
- [ ] Cannot interact when not your turn

### Test Cases
```typescript
// E2E tests with Playwright
describe('Input Handling', () => {
  test('selecting piece highlights valid moves', async ({ page }) => {
    await page.goto('/game/test-game');
    await page.waitForSelector('[data-testid="game-board"]');

    // Click on own warrior
    await page.click('[data-piece-id="p1_w1"]');

    // Valid moves should be highlighted
    const highlights = await page.locator('[data-highlight="valid-move"]');
    expect(await highlights.count()).toBeGreaterThan(0);
  });

  test('clicking valid destination makes move', async ({ page }) => {
    await page.goto('/game/test-game');

    await page.click('[data-piece-id="p1_w1"]');
    await page.click('[data-hex="1,0"]'); // Valid destination

    // Should emit move event
    // Wait for state update
    await page.waitForFunction(() => {
      return window.gameState.turnNumber > 0;
    });
  });

  test('cannot select piece when not your turn', async ({ page }) => {
    // Set up game where it's opponent's turn
    await page.goto('/game/test-game-opponent-turn');

    await page.click('[data-piece-id="p1_w1"]');

    // Should not show highlights
    const highlights = await page.locator('[data-highlight="valid-move"]');
    expect(await highlights.count()).toBe(0);
  });
});
```

---

## Task 5.3: Move Animation

### Description
Animate piece movements and game events.

### Work Items
- [ ] Implement piece movement animation
- [ ] Implement chain push stagger animation
- [ ] Implement elimination animation
- [ ] Implement compression animation
- [ ] Add easing functions
- [ ] Handle animation queue
- [ ] Optional: Sound effects

### Animation System
```typescript
interface Animation {
  pieceId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  duration: number;
  delay: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

export class AnimationSystem {
  private animations: Animation[] = [];
  private running = false;
  private renderer: BoardRenderer;
  private state: GameState;

  constructor(renderer: BoardRenderer) {
    this.renderer = renderer;
  }

  animate(events: GameEvent[], state: GameState): Promise<void> {
    this.state = state;
    this.animations = this.eventsToAnimations(events);

    return new Promise((resolve) => {
      this.running = true;
      this.startTime = performance.now();
      this.onComplete = resolve;
      requestAnimationFrame(this.tick.bind(this));
    });
  }

  private eventsToAnimations(events: GameEvent[]): Animation[] {
    const animations: Animation[] = [];
    const baseDelay = 0;
    const staggerDelay = 80; // ms between chain links
    const moveDuration = 200;

    events.forEach((event, index) => {
      if (event.type === 'MOVE' || event.type === 'PUSH') {
        const depth = event.type === 'PUSH' ? event.depth : 0;

        animations.push({
          pieceId: event.pieceId,
          from: this.hexToPixel(event.from),
          to: this.hexToPixel(event.to),
          duration: moveDuration,
          delay: baseDelay + depth * staggerDelay,
          easing: event.type === 'PUSH' ? easeOutBack : easeOutQuad
        });
      }

      if (event.type === 'ELIMINATED') {
        animations.push({
          pieceId: event.pieceId,
          from: this.hexToPixel(event.from),
          to: this.getOffscreenPosition(event.from),
          duration: 400,
          delay: baseDelay + 200,
          easing: easeInQuad,
          onComplete: () => {
            // Could trigger particle effect here
          }
        });
      }
    });

    return animations;
  }

  private tick(currentTime: number): void {
    if (!this.running) return;

    const elapsed = currentTime - this.startTime;
    let allComplete = true;

    // Calculate current positions for each animation
    const positions = new Map<string, { x: number; y: number }>();

    for (const anim of this.animations) {
      const animElapsed = elapsed - anim.delay;

      if (animElapsed < 0) {
        allComplete = false;
        positions.set(anim.pieceId, anim.from);
        continue;
      }

      const progress = Math.min(animElapsed / anim.duration, 1);

      if (progress < 1) {
        allComplete = false;
      }

      const easedProgress = anim.easing(progress);
      const x = anim.from.x + (anim.to.x - anim.from.x) * easedProgress;
      const y = anim.from.y + (anim.to.y - anim.from.y) * easedProgress;

      positions.set(anim.pieceId, { x, y });

      if (progress >= 1 && anim.onComplete) {
        anim.onComplete();
        anim.onComplete = undefined; // Only call once
      }
    }

    // Render frame with animated positions
    this.renderAnimationFrame(positions);

    if (allComplete) {
      this.running = false;
      this.onComplete?.();
    } else {
      requestAnimationFrame(this.tick.bind(this));
    }
  }

  private renderAnimationFrame(positions: Map<string, { x: number; y: number }>): void {
    // Custom render with overridden positions
    this.renderer.renderWithOverrides(this.state, positions);
  }

  private hexToPixel(hex: AxialCoord): { x: number; y: number } {
    // Convert using renderer's method
    return this.renderer.hexToPixel(hex);
  }

  private getOffscreenPosition(hex: AxialCoord): { x: number; y: number } {
    // Calculate position off the edge of the board
    const pixel = this.hexToPixel(hex);
    const angle = Math.atan2(pixel.y, pixel.x);
    const distance = 300; // Off screen distance
    return {
      x: pixel.x + Math.cos(angle) * distance,
      y: pixel.y + Math.sin(angle) * distance
    };
  }
}

// Easing functions
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInQuad(t: number): number {
  return t * t;
}
```

### Definition of Done
- [ ] Moves animate smoothly
- [ ] Chain pushes stagger visually
- [ ] Eliminations are dramatic (piece flies off)
- [ ] Animations don't block input after completion
- [ ] 60fps maintained during animations

### Test Cases
```typescript
describe('Animation System', () => {
  test('completes animation in expected time', async () => {
    const animation = new AnimationSystem(renderer);
    const events: GameEvent[] = [
      { type: 'MOVE', pieceId: 'p1', from: { q: 0, r: 0 }, to: { q: 1, r: 0 } }
    ];

    const start = performance.now();
    await animation.animate(events, state);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeGreaterThan(180); // ~200ms duration
    expect(elapsed).toBeLessThan(300);
  });

  test('chain animations stagger correctly', async () => {
    const positions: Array<{ time: number; pieceId: string }> = [];

    // Mock to capture when each piece starts moving
    jest.spyOn(renderer, 'renderWithOverrides').mockImplementation((state, overrides) => {
      overrides.forEach((pos, pieceId) => {
        positions.push({ time: performance.now(), pieceId });
      });
    });

    const events: GameEvent[] = [
      { type: 'PUSH', pieceId: 'p1', from: {q:0,r:0}, to: {q:1,r:0}, depth: 0 },
      { type: 'PUSH', pieceId: 'p2', from: {q:1,r:0}, to: {q:2,r:0}, depth: 1 },
    ];

    await animation.animate(events, state);

    // p2 should start after p1
    const p1Start = positions.find(p => p.pieceId === 'p1')!.time;
    const p2Start = positions.find(p => p.pieceId === 'p2')!.time;

    expect(p2Start - p1Start).toBeGreaterThan(50); // Stagger delay
  });
});
```

---

## Task 5.4: Game UI

### Description
Implement all UI elements for game information and controls.

### Work Items
- [ ] Turn indicator (whose turn, timer)
- [ ] Player list with piece counts
- [ ] Move history panel (optional)
- [ ] Combat preview tooltip
- [ ] Win/lose modal
- [ ] Starvation warning/selection UI
- [ ] Settings menu
- [ ] Responsive layout

### UI Components
```typescript
// React components (or similar framework)

// Turn Indicator
function TurnIndicator({ state, playerId }: { state: GameState; playerId: string }) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const timeLeft = useTimer(state.turnEndTime);

  return (
    <div className={`turn-indicator ${isMyTurn ? 'my-turn' : ''}`}>
      <div className="current-player">
        <span className="player-color" style={{ background: getPlayerColor(currentPlayer) }} />
        <span className="player-name">{currentPlayer.name}</span>
        {isMyTurn && <span className="your-turn-badge">Your Turn</span>}
      </div>
      {state.config.turnTimerSeconds && (
        <div className="timer">{formatTime(timeLeft)}</div>
      )}
    </div>
  );
}

// Player List
function PlayerList({ state, playerId }: { state: GameState; playerId: string }) {
  return (
    <div className="player-list">
      {state.players.map((player, index) => {
        const pieces = state.pieces.filter(p => p.owner === player.id);
        const warriors = pieces.filter(p => p.type === 'warrior').length;
        const hasJarl = pieces.some(p => p.type === 'jarl');

        return (
          <div
            key={player.id}
            className={`player-row ${player.isEliminated ? 'eliminated' : ''} ${player.id === playerId ? 'self' : ''}`}
          >
            <span className="player-color" style={{ background: getPlayerColor(player) }} />
            <span className="player-name">{player.name}</span>
            <span className="piece-count">
              {hasJarl && '♔'}
              {warriors > 0 && `×${warriors}`}
            </span>
            {player.isEliminated && <span className="eliminated-badge">Out</span>}
          </div>
        );
      })}
    </div>
  );
}

// Combat Preview Tooltip
function CombatPreview({ combat }: { combat: CombatResult | null }) {
  if (!combat) return null;

  return (
    <div className="combat-preview">
      <div className="combat-row">
        <span className="label">Attack:</span>
        <span className="value">{combat.attack}</span>
        <span className="breakdown">
          ({combat.attackBreakdown.base} base
          {combat.attackBreakdown.momentum > 0 && ` + ${combat.attackBreakdown.momentum} momentum`}
          {combat.attackBreakdown.support > 0 && ` + ${combat.attackBreakdown.support} support`})
        </span>
      </div>
      <div className="combat-row">
        <span className="label">Defense:</span>
        <span className="value">{combat.defense}</span>
        <span className="breakdown">
          ({combat.defenseBreakdown.base} base
          {combat.defenseBreakdown.bracing > 0 && ` + ${combat.defenseBreakdown.bracing} brace`})
        </span>
      </div>
      <div className={`result ${combat.outcome}`}>
        {combat.outcome === 'push' ? '✓ PUSH' : '✗ BLOCKED'}
      </div>
    </div>
  );
}

// Game End Modal
function GameEndModal({ state, playerId, onPlayAgain, onLeave }) {
  if (!state.winner) return null;

  const isWinner = state.winner === playerId;
  const winnerPlayer = state.players.find(p => p.id === state.winner);

  return (
    <div className="modal-overlay">
      <div className="modal game-end-modal">
        <h2 className={isWinner ? 'victory' : 'defeat'}>
          {isWinner ? 'Victory!' : 'Defeat'}
        </h2>
        <p>
          {winnerPlayer?.name} wins by{' '}
          {state.winCondition === 'throne' ? 'claiming the Throne' : 'being the last Jarl standing'}
        </p>
        <div className="modal-actions">
          <button onClick={onPlayAgain}>Play Again</button>
          <button onClick={onLeave}>Leave</button>
        </div>
      </div>
    </div>
  );
}

// Starvation Selection
function StarvationSelection({ choices, playerId, onSelect }) {
  const myChoice = choices.find(c => c.playerId === playerId);

  if (!myChoice || myChoice.choice) return null;

  return (
    <div className="modal-overlay">
      <div className="modal starvation-modal">
        <h2>Starvation!</h2>
        <p>Choose which Warrior must be sacrificed:</p>
        <div className="warrior-choices">
          {myChoice.candidates.map(pieceId => (
            <button
              key={pieceId}
              onClick={() => onSelect(pieceId)}
              className="warrior-choice"
            >
              Warrior at {getPiecePosition(pieceId)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Definition of Done
- [ ] All game state clearly visible
- [ ] Turn indicator shows whose turn + timer
- [ ] Player list shows piece counts
- [ ] Combat preview accurate and helpful
- [ ] Win/lose screen appears correctly
- [ ] Starvation UI works
- [ ] Responsive on mobile

### Test Cases
```typescript
// E2E tests
describe('Game UI', () => {
  test('shows turn indicator', async ({ page }) => {
    await page.goto('/game/test-game');

    const indicator = page.locator('[data-testid="turn-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('Alice');
  });

  test('shows your turn badge when active', async ({ page }) => {
    await page.goto('/game/test-game-my-turn');

    const badge = page.locator('[data-testid="your-turn-badge"]');
    await expect(badge).toBeVisible();
  });

  test('shows game end modal on victory', async ({ page }) => {
    await page.goto('/game/test-game');
    await triggerVictory(page);

    const modal = page.locator('[data-testid="game-end-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Victory');
  });

  test('combat preview shows on hover', async ({ page }) => {
    await page.goto('/game/test-game-my-turn');

    // Select piece
    await page.click('[data-piece-id="p1_w1"]');

    // Hover over attack destination
    await page.hover('[data-hex="1,0"]');

    const preview = page.locator('[data-testid="combat-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Attack:');
  });
});
```

---

## Task 5.5: Lobby UI

### Description
Implement game lobby for creating/joining games.

### Work Items
- [ ] Game creation form
- [ ] Active games list
- [ ] Join game flow
- [ ] Player ready status
- [ ] Game settings preview
- [ ] Spectator mode entry

### Lobby Components
```typescript
// Create Game Form
function CreateGameForm({ onCreate }) {
  const [config, setConfig] = useState({
    playerCount: 2,
    turnTimerSeconds: 60,
    vsAI: false,
    aiDifficulty: 'medium'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onCreate(config); }}>
      <h2>Create New Game</h2>

      <label>
        Players:
        <select
          value={config.playerCount}
          onChange={(e) => setConfig({ ...config, playerCount: parseInt(e.target.value) })}
        >
          {[2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n} Players</option>
          ))}
        </select>
      </label>

      <label>
        Turn Timer:
        <select
          value={config.turnTimerSeconds ?? 'none'}
          onChange={(e) => setConfig({
            ...config,
            turnTimerSeconds: e.target.value === 'none' ? null : parseInt(e.target.value)
          })}
        >
          <option value="none">No Timer</option>
          <option value="30">30 seconds</option>
          <option value="60">1 minute</option>
          <option value="120">2 minutes</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={config.vsAI}
          onChange={(e) => setConfig({ ...config, vsAI: e.target.checked })}
        />
        vs AI
      </label>

      {config.vsAI && (
        <label>
          AI Difficulty:
          <select
            value={config.aiDifficulty}
            onChange={(e) => setConfig({ ...config, aiDifficulty: e.target.value })}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      )}

      <button type="submit">Create Game</button>
    </form>
  );
}

// Game List
function GameList({ games, onJoin, onSpectate }) {
  return (
    <div className="game-list">
      <h2>Join a Game</h2>
      {games.length === 0 ? (
        <p>No games available. Create one!</p>
      ) : (
        <ul>
          {games.map(game => (
            <li key={game.gameId} className="game-item">
              <div className="game-info">
                <span className="players">
                  {game.currentPlayers}/{game.maxPlayers} players
                </span>
                <span className="created">
                  {formatRelativeTime(game.createdAt)}
                </span>
              </div>
              <div className="game-actions">
                {game.status === 'lobby' && game.currentPlayers < game.maxPlayers && (
                  <button onClick={() => onJoin(game.gameId)}>Join</button>
                )}
                {game.status === 'playing' && (
                  <button onClick={() => onSpectate(game.gameId)}>Watch</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Game Lobby (waiting for players)
function GameLobby({ game, playerId, onStart, onLeave }) {
  const canStart = game.players.length >= 2;
  const isHost = game.players[0]?.id === playerId;

  return (
    <div className="game-lobby">
      <h2>Waiting for Players</h2>

      <div className="player-slots">
        {Array.from({ length: game.config.playerCount }).map((_, i) => {
          const player = game.players[i];
          return (
            <div key={i} className={`player-slot ${player ? 'filled' : 'empty'}`}>
              {player ? (
                <>
                  <span className="player-name">{player.name}</span>
                  {player.isAI && <span className="ai-badge">AI</span>}
                </>
              ) : (
                <span className="waiting">Waiting...</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="lobby-actions">
        {isHost && (
          <button onClick={onStart} disabled={!canStart}>
            Start Game
          </button>
        )}
        <button onClick={onLeave}>Leave</button>
      </div>
    </div>
  );
}
```

### Definition of Done
- [ ] Can create games with options
- [ ] Can see and join available games
- [ ] Lobby shows connected players
- [ ] Host can start when ready
- [ ] Can spectate ongoing games
- [ ] Responsive design

---

## Phase 5 Checklist

### Prerequisites
- [ ] Phase 3 complete (network layer)
- [ ] Phase 4 complete or skipped

### Completion Criteria
- [ ] Task 5.1 complete (rendering)
- [ ] Task 5.2 complete (input)
- [ ] Task 5.3 complete (animation)
- [ ] Task 5.4 complete (game UI)
- [ ] Task 5.5 complete (lobby)
- [ ] Complete game playable in browser
- [ ] Works on mobile

### Handoff to Phase 6
- Full client implemented
- Playable end-to-end
- Ready for polish and deployment

---

*Phase 5 Status: Not Started*
