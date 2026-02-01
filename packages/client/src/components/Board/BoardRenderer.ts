/**
 * BoardRenderer - Canvas-based renderer for the Jarls hex board.
 *
 * Manages canvas context, hex sizing, and coordinate calculations
 * for rendering the game board.
 */

import type { AxialCoord, Piece, GameState, ValidMove } from '@jarls/shared';
import { generateAllBoardHexesAxial } from '@jarls/shared';
import type { AnimatedPiece } from './AnimationSystem';
import { hexToPixel, getHexCorners } from '../../utils/hexMath';

/** Default fill color for normal board hexes */
const DEFAULT_HEX_FILL = '#2a2a3e';
/** Default stroke color for hex borders */
const DEFAULT_HEX_STROKE = '#4a4a5e';
/** Fill color for the Throne hex at (0,0) */
const THRONE_FILL = '#b8860b';
/** Stroke color for the Throne hex */
const THRONE_STROKE = '#daa520';
/** Fill color for hole hexes */
const HOLE_FILL = '#1a1a1a';
/** Stroke color for hole hexes */
const HOLE_STROKE = '#3a3a3a';
/** Default player color palette (fallback only) */
const COLOR_PALETTE = ['#e63946', '#457b9d', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1'];
/** Piece shadow color */
const PIECE_SHADOW = 'rgba(0, 0, 0, 0.4)';
/** Selection highlight ring color */
const SELECTION_STROKE = '#ffffff';
/** Valid move overlay color (green) */
const VALID_MOVE_FILL = 'rgba(76, 175, 80, 0.35)';
const VALID_MOVE_STROKE = '#4caf50';
/** Attack move overlay color (red) */
const ATTACK_MOVE_FILL = 'rgba(244, 67, 54, 0.35)';
const ATTACK_MOVE_STROKE = '#f44336';
/** Momentum indicator color */
const MOMENTUM_COLOR = '#ffeb3b';
/** Current player piece glow color */
const CURRENT_PLAYER_GLOW = 'rgba(255, 255, 255, 0.25)';

/** Options for rendering highlights alongside the base board/pieces. */
export interface RenderHighlights {
  /** Hex of the currently selected piece */
  selectedHex?: AxialCoord;
  /** Valid moves for the selected piece */
  validMoves?: ValidMove[];
  /** Player ID whose turn it currently is (for piece glow) */
  currentPlayerId?: string;
}

export interface BoardDimensions {
  /** Pixel size of each hex (center to corner) */
  hexSize: number;
  /** Canvas center X coordinate */
  centerX: number;
  /** Canvas center Y coordinate */
  centerY: number;
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private dimensions: BoardDimensions | null = null;
  private boardRadius: number | null = null;
  /** Player colors from game state, indexed by player ID */
  private playerColors: Record<string, string> = {};

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Get the current canvas rendering context.
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Get the current board dimensions, or null if not yet calculated.
   */
  getDimensions(): BoardDimensions | null {
    return this.dimensions;
  }

  /**
   * Calculate hex size and canvas center for a given board radius and canvas size.
   *
   * The hex size is computed so that the entire board (all hexes within the radius)
   * fits within the canvas with padding. For a pointy-top hex layout:
   * - Board width  = 2 * hexSize * sqrt(3) * radius + hexSize * sqrt(3)
   * - Board height = 2 * hexSize * (3/2) * radius + 2 * hexSize
   *
   * We pick the largest hexSize that fits both dimensions, with 10% padding.
   */
  calculateDimensions(
    boardRadius: number,
    canvasWidth: number,
    canvasHeight: number
  ): BoardDimensions {
    const padding = 0.96; // 4% padding on each side

    // For pointy-top hexes:
    // Total width in hex-size units: sqrt(3) * (2 * radius + 1)
    // Total height in hex-size units: 3 * radius + 2
    const sqrt3 = Math.sqrt(3);
    const widthInHexUnits = sqrt3 * (2 * boardRadius + 1);
    const heightInHexUnits = 3 * boardRadius + 2;

    const maxSizeByWidth = (canvasWidth * padding) / widthInHexUnits;
    const maxSizeByHeight = (canvasHeight * padding) / heightInHexUnits;

    const hexSize = Math.min(maxSizeByWidth, maxSizeByHeight);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    this.dimensions = {
      hexSize,
      centerX,
      centerY,
      canvasWidth,
      canvasHeight,
    };

    return this.dimensions;
  }

  /**
   * Draw a single hex at the given axial coordinate with specified colors.
   * Requires dimensions to be calculated first via calculateDimensions().
   */
  drawHex(hex: AxialCoord, fillColor: string, strokeColor: string): void {
    const dims = this.dimensions;
    if (!dims) return;

    const { x, y } = hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);
    const corners = getHexCorners(x, y, dims.hexSize);
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Handle canvas resize by recalculating dimensions for the current board radius.
   * Updates the canvas element size and recalculates hex sizing/positioning.
   * Returns the new dimensions, or null if no board radius has been set.
   */
  handleResize(canvasWidth: number, canvasHeight: number): BoardDimensions | null {
    if (this.boardRadius === null) return null;

    const canvas = this.ctx.canvas;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    return this.calculateDimensions(this.boardRadius, canvasWidth, canvasHeight);
  }

  /**
   * Draw the full hex grid for a board of the given radius.
   * The Throne hex at (0,0) is highlighted in gold.
   * All other hexes use the default dark fill with subtle gray borders.
   */
  drawGrid(boardRadius: number): void {
    this.boardRadius = boardRadius;
    const hexes = generateAllBoardHexesAxial(boardRadius);

    for (const hex of hexes) {
      const isThrone = hex.q === 0 && hex.r === 0;
      if (isThrone) {
        this.drawHex(hex, THRONE_FILL, THRONE_STROKE);
      } else {
        this.drawHex(hex, DEFAULT_HEX_FILL, DEFAULT_HEX_STROKE);
      }
    }
  }

  /**
   * Get a color for a given player ID.
   * Uses the actual player color from game state, falls back to palette if missing.
   */
  getPlayerColor(playerId: string): string {
    if (this.playerColors[playerId]) {
      return this.playerColors[playerId];
    }
    // Fallback to palette for any missing players
    const index = Object.keys(this.playerColors).length;
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  }

  /**
   * Set player colors from game state.
   * Should be called before rendering to ensure correct colors.
   */
  setPlayerColors(players: Array<{ id: string; color: string }>): void {
    this.playerColors = {};
    for (const player of players) {
      this.playerColors[player.id] = player.color;
    }
  }

  /**
   * Draw a hole on the board.
   * Renders the hex as a dark void that pieces fall into.
   */
  drawHole(hex: AxialCoord): void {
    const dims = this.dimensions;
    if (!dims) return;

    this.drawHex(hex, HOLE_FILL, HOLE_STROKE);

    const { x, y } = hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);
    const radius = dims.hexSize * 0.4;
    const ctx = this.ctx;

    // Inner dark circle to represent the pit
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.7, '#0a0a0a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Draw all holes on the board.
   */
  drawHoles(holes: AxialCoord[]): void {
    for (const hole of holes) {
      this.drawHole(hole);
    }
  }

  /**
   * Draw a Warrior piece as a colored circle at its position.
   */
  drawWarrior(piece: Piece): void {
    const dims = this.dimensions;
    if (!dims || !piece.playerId) return;

    const { x, y } = hexToPixel(piece.position, dims.hexSize, dims.centerX, dims.centerY);
    const radius = dims.hexSize * 0.35;
    const color = this.getPlayerColor(piece.playerId);
    const ctx = this.ctx;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_SHADOW;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw a Jarl piece as a larger circle with a crown indicator.
   */
  drawJarl(piece: Piece): void {
    const dims = this.dimensions;
    if (!dims || !piece.playerId) return;

    const { x, y } = hexToPixel(piece.position, dims.hexSize, dims.centerX, dims.centerY);
    const radius = dims.hexSize * 0.42;
    const color = this.getPlayerColor(piece.playerId);
    const ctx = this.ctx;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_SHADOW;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crown indicator: three small triangles on top
    const crownY = y - radius * 0.3;
    const crownSize = radius * 0.35;
    const points = [-0.6, 0, 0.6];

    ctx.fillStyle = '#ffd700';
    for (const offset of points) {
      const cx = x + offset * radius;
      ctx.beginPath();
      ctx.moveTo(cx, crownY - crownSize);
      ctx.lineTo(cx - crownSize * 0.4, crownY + crownSize * 0.3);
      ctx.lineTo(cx + crownSize * 0.4, crownY + crownSize * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Draw all pieces on the board.
   * Warriors are drawn first, then jarls on top.
   */
  drawPieces(pieces: Piece[]): void {
    const warriors: Piece[] = [];
    const jarls: Piece[] = [];

    for (const piece of pieces) {
      if (piece.type === 'warrior') warriors.push(piece);
      else if (piece.type === 'jarl') jarls.push(piece);
    }

    for (const piece of warriors) {
      this.drawWarrior(piece);
    }
    for (const piece of jarls) {
      this.drawJarl(piece);
    }
  }

  /**
   * Draw a highlight ring around the selected piece's hex.
   */
  drawSelection(hex: AxialCoord): void {
    const dims = this.dimensions;
    if (!dims) return;

    const { x, y } = hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);
    const corners = getHexCorners(x, y, dims.hexSize * 0.92);
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    ctx.strokeStyle = SELECTION_STROKE;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /**
   * Draw green overlays on valid move destinations (non-attack moves).
   */
  drawValidMoves(moves: ValidMove[]): void {
    for (const move of moves) {
      if (move.moveType === 'move') {
        this.drawHex(move.destination, VALID_MOVE_FILL, VALID_MOVE_STROKE);
      }
    }
  }

  /**
   * Draw red overlays on attack move destinations.
   */
  drawAttackMoves(moves: ValidMove[]): void {
    for (const move of moves) {
      if (move.moveType === 'attack') {
        this.drawHex(move.destination, ATTACK_MOVE_FILL, ATTACK_MOVE_STROKE);
      }
    }
  }

  /**
   * Draw a small "+1" momentum indicator near the top of a hex.
   */
  drawMomentumIndicator(hex: AxialCoord): void {
    const dims = this.dimensions;
    if (!dims) return;

    const { x, y } = hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);
    const ctx = this.ctx;
    const fontSize = Math.max(10, dims.hexSize * 0.3);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Position near top-right of hex
    const indicatorX = x + dims.hexSize * 0.35;
    const indicatorY = y - dims.hexSize * 0.45;

    // Background circle
    const bgRadius = fontSize * 0.65;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, bgRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // Text
    ctx.fillStyle = MOMENTUM_COLOR;
    ctx.fillText('+1', indicatorX, indicatorY);
  }

  /**
   * Draw a subtle glow around pieces belonging to the current player.
   */
  drawCurrentPlayerGlow(pieces: Piece[], currentPlayerId: string): void {
    const dims = this.dimensions;
    if (!dims) return;

    const ctx = this.ctx;
    for (const piece of pieces) {
      if (piece.playerId !== currentPlayerId) continue;

      const { x, y } = hexToPixel(piece.position, dims.hexSize, dims.centerX, dims.centerY);
      const radius = piece.type === 'jarl' ? dims.hexSize * 0.52 : dims.hexSize * 0.45;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = CURRENT_PLAYER_GLOW;
      ctx.fill();
    }
  }

  /**
   * Full render pass: clear the canvas, draw the hex grid, draw pieces,
   * and overlay any active highlights (selection, valid moves, glow).
   */
  render(state: GameState, highlights?: RenderHighlights): void {
    const canvas = this.ctx.canvas;

    // Ensure dimensions are calculated
    if (!this.dimensions) {
      this.calculateDimensions(state.config.boardRadius, canvas.width, canvas.height);
    }

    // Set player colors from game state
    this.setPlayerColors(state.players);

    // Clear entire canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hex grid
    this.drawGrid(state.config.boardRadius);

    // Draw holes on top of grid
    this.drawHoles(state.holes);

    // Draw current player glow (behind pieces)
    if (highlights?.currentPlayerId) {
      this.drawCurrentPlayerGlow(state.pieces, highlights.currentPlayerId);
    }

    // Draw all pieces
    this.drawPieces(state.pieces);

    // Draw selection and valid move highlights (on top of pieces)
    if (highlights?.selectedHex) {
      this.drawSelection(highlights.selectedHex);
    }
    if (highlights?.validMoves) {
      this.drawValidMoves(highlights.validMoves);
      this.drawAttackMoves(highlights.validMoves);

      // Draw momentum indicators on attack moves with momentum
      for (const move of highlights.validMoves) {
        if (move.moveType === 'attack' && move.hasMomentum) {
          this.drawMomentumIndicator(move.destination);
        }
      }
    }
  }

  /**
   * Render the board with animated piece overrides.
   * Pieces listed in animatedPieces are drawn at their interpolated pixel positions
   * instead of their game-state positions. Pieces whose animation has completed
   * (not in the animatedPieces list) are skipped — the caller applies the final
   * state after the full animation sequence finishes.
   */
  renderAnimatedFrame(
    state: GameState,
    animatedPieces: AnimatedPiece[],
    animatingPieceIds: Set<string>
  ): void {
    const canvas = this.ctx.canvas;

    // Ensure dimensions are calculated
    if (!this.dimensions) {
      this.calculateDimensions(state.config.boardRadius, canvas.width, canvas.height);
    }
    const dims = this.dimensions!;

    // Clear entire canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hex grid
    this.drawGrid(state.config.boardRadius);

    // Draw holes on top of grid
    this.drawHoles(state.holes);

    // Draw non-animated pieces at their normal positions
    const staticPieces = state.pieces.filter((p) => !animatingPieceIds.has(p.id));
    this.drawPieces(staticPieces);

    // Draw animated pieces at their interpolated positions
    const ctx = this.ctx;
    for (const ap of animatedPieces) {
      const piece = state.pieces.find((p) => p.id === ap.pieceId);
      if (!piece) continue;

      ctx.save();
      ctx.globalAlpha = ap.opacity;

      if (piece.type === 'jarl') {
        this.drawJarlAt(ap.x, ap.y, piece, dims);
      } else {
        this.drawWarriorAt(ap.x, ap.y, piece, dims);
      }

      ctx.restore();
    }
  }

  /**
   * Draw a Warrior at a specific pixel position (for animation).
   */
  private drawWarriorAt(x: number, y: number, piece: Piece, dims: BoardDimensions): void {
    if (!piece.playerId) return;

    const radius = dims.hexSize * 0.35;
    const color = this.getPlayerColor(piece.playerId);
    const ctx = this.ctx;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_SHADOW;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw a Jarl at a specific pixel position (for animation).
   */
  private drawJarlAt(x: number, y: number, piece: Piece, dims: BoardDimensions): void {
    if (!piece.playerId) return;

    const radius = dims.hexSize * 0.42;
    const color = this.getPlayerColor(piece.playerId);
    const ctx = this.ctx;

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = PIECE_SHADOW;
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crown indicator: three small triangles on top
    const crownY = y - radius * 0.3;
    const crownSize = radius * 0.35;
    const points = [-0.6, 0, 0.6];

    ctx.fillStyle = '#ffd700';
    for (const offset of points) {
      const cx = x + offset * radius;
      ctx.beginPath();
      ctx.moveTo(cx, crownY - crownSize);
      ctx.lineTo(cx - crownSize * 0.4, crownY + crownSize * 0.3);
      ctx.lineTo(cx + crownSize * 0.4, crownY + crownSize * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}
