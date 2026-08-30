/**
 * Where the reader is, in a scrolling column of paragraphs.
 *
 * This was an IntersectionObserver watching for the topmost paragraph at least
 * half visible, and it did not survive contact with the demo text: paragraphs
 * of eight hundred words are taller than the phone, so the rule that was meant
 * to identify them quietly never fired. The position stayed on paragraph zero
 * for a whole document — which broke restoring your place, pinned the flip
 * rate's denominator at one paragraph, and sent every flip back to the top.
 *
 * Arithmetic on offsets instead. It is less clever, it is exact, and it can be
 * tested without a browser.
 */

export interface Paragraph {
  /** Offset of the paragraph's top within the scrolling element. */
  top: number;
  height: number;
}

export interface Position {
  index: number;
  /** How far through that paragraph the reader is, 0 to 1. */
  fraction: number;
}

/**
 * The paragraph the reader is in, and how far into it.
 *
 * "In" means occupying the top of the viewport — the last paragraph that has
 * begun above the fold. A paragraph taller than the screen therefore stays
 * current for as long as it fills the screen, which is exactly the case the
 * old rule could not express.
 */
export function positionOf(
  paragraphs: Paragraph[],
  scrollTop: number,
  viewportHeight: number,
): Position {
  if (paragraphs.length === 0) return { index: 0, fraction: 0 };

  // A paragraph counts as reached once its top passes a little into the
  // screen, rather than exactly at the edge: the eye is reading slightly
  // below the top of the viewport, not at it.
  const eyeline = scrollTop + Math.min(viewportHeight * 0.25, 120);

  let index = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].top <= eyeline) index = i;
    else break;
  }

  const { top, height } = paragraphs[index];
  const fraction = height > 0 ? (scrollTop - top) / height : 0;

  return { index, fraction: Math.min(1, Math.max(0, fraction)) };
}

/**
 * Where to scroll so that `position` lands in the same place in another column.
 *
 * The fraction matters as much as the index. German and English paragraphs are
 * different lengths, and a paragraph can be several screens tall — landing at
 * the top of the right paragraph still means losing your place by a page and a
 * half, which is what "it jumps to the top" actually was.
 */
export function scrollTopFor(
  paragraphs: Paragraph[],
  position: Position,
  landingOffset: number,
): number {
  const paragraph = paragraphs[position.index];
  if (!paragraph) return 0;

  const into = paragraph.height * position.fraction;
  return Math.max(0, paragraph.top + into - landingOffset);
}
