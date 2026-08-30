import { useCallback, useEffect, useRef, useState } from 'react';
import { positionOf, type Paragraph } from '@/lib/readingPosition';

/**
 * Tracks which paragraph the reader is on, inside a scroll container.
 *
 * This index is the backbone of three things — restoring your place, landing
 * the flip where you were, and the denominator of the flip rate — so it is
 * worth being exactly right rather than approximately clever.
 *
 * It reads scroll offsets rather than watching intersections. The observer
 * this replaced asked for the topmost paragraph at least half visible, which
 * silently never matched a paragraph taller than the screen; on a text of long
 * paragraphs the position sat on zero for the whole document and nobody could
 * see why.
 *
 * `root` is the scrolling element. Each language pane scrolls independently,
 * so each gets its own instance of this hook.
 */
export function useCurrentParagraph(count: number, enabled: boolean, root: HTMLElement | null) {
  const [current, setCurrent] = useState(0);
  const elements = useRef<(HTMLElement | null)[]>([]);

  /** Ref callback for paragraph `index`. Stable across renders. */
  const register = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      elements.current[index] = el;
    },
    [],
  );

  /** Measure the column as laid out right now. */
  const measure = useCallback(
    (): Paragraph[] =>
      elements.current
        .slice(0, count)
        .map((el) => ({ top: el?.offsetTop ?? 0, height: el?.offsetHeight ?? 0 })),
    [count],
  );

  useEffect(() => {
    if (!enabled || count === 0 || !root) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const next = positionOf(measure(), root.scrollTop, root.clientHeight);
      // Only the index drives React. The fraction moves constantly and nothing
      // on screen depends on it; the flip measures it afresh when it needs it.
      setCurrent((previous) => (previous === next.index ? previous : next.index));
    };

    // Coalesced to one read a frame: scroll fires far faster than layout can
    // possibly change, and `offsetTop` forces a reflow when it is read.
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };

    read();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [count, enabled, root, measure]);

  return { current, register, setCurrent, measure };
}
