export type SwipeDirection = 'left' | 'right';

/** Horizontal travel required before a gesture counts as a swipe. */
export const MIN_DISTANCE = 56;

/** Horizontal travel must beat vertical by this much. */
export const RATIO = 2;

/**
 * Decide whether a drag has committed to a horizontal swipe.
 *
 * Returns null while the gesture is still ambiguous or is plainly a vertical
 * scroll. Scrolling a page of prose produces plenty of incidental horizontal
 * drift, and flipping the language by accident mid-sentence would be the most
 * annoying bug this app could have — so the bar is deliberately high.
 */
export function swipeDirection(
  dx: number,
  dy: number,
  minDistance = MIN_DISTANCE,
  ratio = RATIO,
): SwipeDirection | null {
  if (Math.abs(dx) < minDistance) return null;
  if (Math.abs(dx) < Math.abs(dy) * ratio) return null;
  return dx < 0 ? 'left' : 'right';
}
