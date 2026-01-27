import type { AxialCoord, GameEvent, MoveEvent, PushEvent, EliminatedEvent } from '@jarls/shared';

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
}
