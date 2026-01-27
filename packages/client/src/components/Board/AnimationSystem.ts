import type { AxialCoord, GameEvent, MoveEvent, PushEvent, EliminatedEvent } from '@jarls/shared';

/** Pixel coordinate */
export interface PixelCoord {
  x: number;
  y: number;
}

/** Converts a hex coordinate to pixel coordinates */
export type HexToPixelFn = (hex: AxialCoord) => PixelCoord;

/** An animated piece's interpolated rendering state */
export interface AnimatedPiece {
  /** Piece ID */
  pieceId: string;
  /** Current pixel X position */
  x: number;
  /** Current pixel Y position */
  y: number;
  /** Current opacity (0-1), used for elimination fade-out */
  opacity: number;
}

/** Types of animations that can be played */
export type AnimationType = 'move' | 'push' | 'elimination';

/** A single animation to be rendered */
export interface Animation {
  /** ID of the piece being animated */
  pieceId: string;
  /** Starting hex position */
  fromHex: AxialCoord;
  /** Ending hex position (null for eliminations that fly off-board) */
  toHex: AxialCoord | null;
  /** Duration of the animation in milliseconds */
  duration: number;
  /** Delay before the animation starts in milliseconds */
  delay: number;
  /** Type of animation */
  type: AnimationType;
}

/** Default animation durations in ms */
const MOVE_DURATION = 200;
const PUSH_STAGGER_DELAY = 80;
const PUSH_DURATION = 200;
const ELIMINATION_DURATION = 400;

/**
 * AnimationSystem converts GameEvents into a sequence of Animation objects
 * that can be rendered frame-by-frame using requestAnimationFrame.
 */
export class AnimationSystem {
  /**
   * Parse an array of GameEvents into an ordered Animation array.
   * Animations are sequenced so that:
   * - The attacker's move plays first
   * - Push chain animations are staggered by depth
   * - Elimination animations play after pushes complete
   */
  parseEvents(events: GameEvent[]): Animation[] {
    const animations: Animation[] = [];

    const moveEvents = events.filter((e): e is MoveEvent => e.type === 'MOVE');
    const pushEvents = events.filter((e): e is PushEvent => e.type === 'PUSH');
    const eliminationEvents = events.filter((e): e is EliminatedEvent => e.type === 'ELIMINATED');

    // 1. Move animations (attacker movement)
    for (const event of moveEvents) {
      animations.push({
        pieceId: event.pieceId,
        fromHex: event.from,
        toHex: event.to,
        duration: MOVE_DURATION,
        delay: 0,
        type: 'move',
      });
    }

    // 2. Push animations, staggered by depth
    // Pushes start after the move animation completes
    const pushBaseDelay = moveEvents.length > 0 ? MOVE_DURATION : 0;
    for (const event of pushEvents) {
      animations.push({
        pieceId: event.pieceId,
        fromHex: event.from,
        toHex: event.to,
        duration: PUSH_DURATION,
        delay: pushBaseDelay + event.depth * PUSH_STAGGER_DELAY,
        type: 'push',
      });
    }

    // 3. Elimination animations play after all pushes complete
    const maxPushDelay =
      pushEvents.length > 0
        ? pushBaseDelay +
          Math.max(...pushEvents.map((e) => e.depth)) * PUSH_STAGGER_DELAY +
          PUSH_DURATION
        : pushBaseDelay;
    const eliminationDelay =
      pushEvents.length > 0 ? maxPushDelay : moveEvents.length > 0 ? MOVE_DURATION : 0;

    for (const event of eliminationEvents) {
      animations.push({
        pieceId: event.pieceId,
        fromHex: event.position,
        toHex: null,
        duration: ELIMINATION_DURATION,
        delay: eliminationDelay,
        type: 'elimination',
      });
    }

    return animations;
  }

  /**
   * Calculate the total duration of an animation sequence.
   * This is the maximum (delay + duration) across all animations.
   */
  getTotalDuration(animations: Animation[]): number {
    if (animations.length === 0) return 0;
    return Math.max(...animations.map((a) => a.delay + a.duration));
  }

  /**
   * Get the progress (0 to 1) of a specific animation at a given elapsed time.
   * Returns null if the animation hasn't started yet or has already completed.
   */
  getAnimationProgress(animation: Animation, elapsedMs: number): number | null {
    const localTime = elapsedMs - animation.delay;
    if (localTime < 0) return null; // not started
    if (localTime >= animation.duration) return null; // completed
    // Ease-out: 1 - (1 - t)^2
    const t = localTime / animation.duration;
    return 1 - (1 - t) * (1 - t);
  }

  /**
   * Check if all animations in a sequence have completed at a given elapsed time.
   */
  isComplete(animations: Animation[], elapsedMs: number): boolean {
    return elapsedMs >= this.getTotalDuration(animations);
  }

  /**
   * Run an animation sequence using requestAnimationFrame.
   *
   * On each frame, computes the interpolated position/opacity of every
   * active animation and calls `renderFrame` with the results. The caller
   * is responsible for redrawing the board using the provided overrides.
   *
   * @param animations - The animation sequence (from parseEvents)
   * @param hexToPixel - Converts hex coords to canvas pixel coords
   * @param renderFrame - Called each frame with currently-animating pieces
   * @returns Promise that resolves when all animations are complete
   */
  animate(
    animations: Animation[],
    hexToPixel: HexToPixelFn,
    renderFrame: (animatedPieces: AnimatedPiece[]) => void
  ): Promise<void> {
    if (animations.length === 0) return Promise.resolve();

    const totalDuration = this.getTotalDuration(animations);

    return new Promise<void>((resolve) => {
      let startTime: number | null = null;

      const tick = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;

        const animatedPieces: AnimatedPiece[] = [];

        for (const anim of animations) {
          const progress = this.getAnimationProgress(anim, elapsed);

          // Piece hasn't started yet — render at fromHex (waiting position)
          if (progress === null && elapsed < anim.delay) {
            const from = hexToPixel(anim.fromHex);
            animatedPieces.push({
              pieceId: anim.pieceId,
              x: from.x,
              y: from.y,
              opacity: 1,
            });
            continue;
          }

          // Piece has completed — skip (final state handled by caller)
          if (progress === null) continue;

          if (anim.type === 'elimination') {
            // Elimination: fly outward from position toward board edge, fading out
            const from = hexToPixel(anim.fromHex);
            const dir = this.getEliminationDirection(anim.fromHex);
            // Fly 300px in the outward direction over the animation
            const flyDistance = 300;
            animatedPieces.push({
              pieceId: anim.pieceId,
              x: from.x + dir.x * flyDistance * progress,
              y: from.y + dir.y * flyDistance * progress,
              opacity: 1 - progress,
            });
          } else {
            // Move or push: interpolate from fromHex to toHex
            const from = hexToPixel(anim.fromHex);
            const to = anim.toHex ? hexToPixel(anim.toHex) : from;
            animatedPieces.push({
              pieceId: anim.pieceId,
              x: from.x + (to.x - from.x) * progress,
              y: from.y + (to.y - from.y) * progress,
              opacity: 1,
            });
          }
        }

        renderFrame(animatedPieces);

        if (elapsed < totalDuration) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  /**
   * Compute a normalized direction vector pointing outward from the board center
   * for elimination fly-off animations. If the piece is at the center, defaults
   * to pointing upward.
   */
  private getEliminationDirection(hex: AxialCoord): PixelCoord {
    // Use axial coords as a rough direction from center (0,0)
    const dx = hex.q + hex.r * 0.5;
    const dy = hex.r * 0.866; // sqrt(3)/2
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return { x: 0, y: -1 }; // center piece goes up
    return { x: dx / len, y: dy / len };
  }
}
