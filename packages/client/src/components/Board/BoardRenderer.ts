/**
 * BoardRenderer - Canvas-based renderer for the Jarls hex board.
 *
 * Manages canvas context, hex sizing, and coordinate calculations
 * for rendering the game board.
 */

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
}
