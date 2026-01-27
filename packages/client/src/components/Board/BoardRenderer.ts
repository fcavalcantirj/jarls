/**
 * BoardRenderer - Canvas-based renderer for the Jarls hex board.
 *
 * Manages canvas context, hex sizing, and coordinate calculations
 * for rendering the game board.
 */

import type { AxialCoord, Piece, GameState, ValidMove } from '@jarls/shared';
import { generateAllBoardHexesAxial } from '@jarls/shared';
import { hexToPixel, getHexCorners } from '../../utils/hexMath';

/** Default fill color for normal board hexes */
const DEFAULT_HEX_FILL = '#2a2a3e';
/** Default stroke color for hex borders */
const DEFAULT_HEX_STROKE = '#4a4a5e';
/** Fill color for the Throne hex at (0,0) */
const THRONE_FILL = '#b8860b';
/** Stroke color for the Throne hex */
const THRONE_STROKE = '#daa520';
/** Fill color for shield hexes */
const SHIELD_FILL = '#6b6b7b';
/** Stroke color for shield hexes */
const SHIELD_STROKE = '#8a8a9a';
/** Player colors indexed by player order */
const PLAYER_COLORS: Record<string, string> = {};
/** Default player color palette */
const COLOR_PALETTE = ['#e63946', '#457b9d'];
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
    const padding = 0.9; // 10% padding on each side

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
   * Assigns colors from the palette on first encounter and caches them.
   */
  getPlayerColor(playerId: string): string {
    if (!PLAYER_COLORS[playerId]) {
      const index = Object.keys(PLAYER_COLORS).length;
      PLAYER_COLORS[playerId] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    }
    return PLAYER_COLORS[playerId];
  }

  /**
   * Draw a shield piece on the board.
   * Renders the hex with a gray fill and a shield icon (simple diamond shape).
   */
  drawShield(hex: AxialCoord): void {
    const dims = this.dimensions;
    if (!dims) return;

    this.drawHex(hex, SHIELD_FILL, SHIELD_STROKE);

    const { x, y } = hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);
    const iconSize = dims.hexSize * 0.35;
    const ctx = this.ctx;

    // Shield icon: a simple diamond/kite shape
    ctx.beginPath();
    ctx.moveTo(x, y - iconSize);
    ctx.lineTo(x + iconSize * 0.7, y);
    ctx.lineTo(x, y + iconSize * 0.8);
    ctx.lineTo(x - iconSize * 0.7, y);
    ctx.closePath();

    ctx.fillStyle = '#c0c0c0';
    ctx.fill();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
   * Shields are drawn first (as hex overlays), then warriors, then jarls on top.
   */
  drawPieces(pieces: Piece[]): void {
    const shields: Piece[] = [];
    const warriors: Piece[] = [];
    const jarls: Piece[] = [];

    for (const piece of pieces) {
      if (piece.type === 'shield') shields.push(piece);
      else if (piece.type === 'warrior') warriors.push(piece);
      else if (piece.type === 'jarl') jarls.push(piece);
    }

    for (const piece of shields) {
      this.drawShield(piece.position);
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
      if (piece.type === 'shield') continue;

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

    // Clear entire canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw hex grid
    this.drawGrid(state.config.boardRadius);

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
}
