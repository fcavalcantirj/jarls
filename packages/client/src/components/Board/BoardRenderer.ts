/**
 * BoardRenderer - Canvas-based renderer for the Jarls hex board.
 *
 * Manages canvas context, hex sizing, and coordinate calculations
 * for rendering the game board.
 */

import type { AxialCoord } from '@jarls/shared';
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
   * Draw the full hex grid for a board of the given radius.
   * The Throne hex at (0,0) is highlighted in gold.
   * All other hexes use the default dark fill with subtle gray borders.
   */
  drawGrid(boardRadius: number): void {
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
}
