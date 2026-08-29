import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks which paragraph the reader is currently on, inside a scroll container.
 *
 * The current paragraph is the topmost one at least 50% visible. This index is
 * the backbone of the flip, of position restore, and of the flip-rate
 * statistic, so it is worth getting right rather than approximating from
 * scrollTop.
 *
 * One case the 50% rule alone gets wrong: a paragraph taller than the viewport
 * can never reach 50% visibility, so it would be skipped entirely while it is
 * the only thing on screen. Such a paragraph counts as current when it spans
 * the container from top to bottom.
 *
 * `root` is the scrolling element. Each language pane scrolls independently,
 * so each gets its own instance of this hook.
 */
export function useCurrentParagraph(
  count: number,
  enabled: boolean,
  root: HTMLElement | null,
) {
  const [current, setCurrent] = useState(0);
  const elements = useRef<(HTMLElement | null)[]>([]);

  /** Ref callback for paragraph `index`. Stable across renders. */
  const register = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      elements.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    if (!enabled || count === 0 || !root) return;

    // index -> whether it currently qualifies as visible
    const visible = new Map<number, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        const rootHeight = root.clientHeight;

        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(index)) continue;

          const rootTop = entry.rootBounds?.top ?? 0;
          const rect = entry.boundingClientRect;
          const spansRoot = rect.top <= rootTop && rect.bottom >= rootTop + rootHeight;

          visible.set(index, entry.intersectionRatio >= 0.5 || spansRoot);
        }

        let topmost = -1;
        for (const [index, isVisible] of visible) {
          if (isVisible && (topmost === -1 || index < topmost)) topmost = index;
        }
        if (topmost !== -1) setCurrent(topmost);
      },
      // Several thresholds so the callback fires as a paragraph crosses the
      // halfway mark in either direction, not only on enter and leave.
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const el of elements.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [count, enabled, root]);

  return { current, register, setCurrent };
}
