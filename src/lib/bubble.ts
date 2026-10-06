/**
 * Where the definition bubble sits, given the held word's box on screen.
 *
 * Pure so it can be tested without a browser. The bubble floats over the
 * text and never moves it: it is placed in viewport coordinates, above the
 * word when there is room and below it near the top of the screen.
 */

/** How long a press has to last before it is a hold rather than a tap. */
export const HOLD_MS = 450;

/** A finger that drifts further than this is scrolling, not holding. */
export const HOLD_SLOP = 10;

export interface WordRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface BubblePlacement {
  left: number;
  /** The edge nearest the word: the bubble's bottom when above, top when below. */
  top: number;
  width: number;
  above: boolean;
  /** The pointer's centre, measured from the bubble's left edge. */
  arrowX: number;
}

const MAX_WIDTH = 288;
const MARGIN = 16;
const GAP = 10;
/** Below this, a bubble above the word would run off the top of the screen. */
const ROOM_ABOVE = 160;
/** Keeps the pointer clear of the bubble's rounded corners. */
const ARROW_INSET = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** True once a press has moved far enough to be a scroll or a swipe. */
export function movedTooFar(dx: number, dy: number, slop = HOLD_SLOP): boolean {
  return dx * dx + dy * dy > slop * slop;
}

export function placeBubble(word: WordRect, viewportWidth: number): BubblePlacement {
  const width = Math.max(0, Math.min(MAX_WIDTH, viewportWidth - 2 * MARGIN));
  const centre = (word.left + word.right) / 2;
  const left = clamp(centre - width / 2, MARGIN, Math.max(MARGIN, viewportWidth - MARGIN - width));
  const above = word.top >= ROOM_ABOVE;

  return {
    left,
    top: above ? word.top - GAP : word.bottom + GAP,
    width,
    above,
    arrowX: clamp(centre - left, ARROW_INSET, width - ARROW_INSET),
  };
}
