import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';

/** Two taps closer together than this on the same word count as a double tap. */
const WINDOW_MS = 320;

/**
 * Double-tap a word. One handler on the pane, not one per word.
 *
 * `touch-action: manipulation` on the reading view removes the browser's
 * 300ms click delay and its double-tap zoom, so a plain click event is both
 * fast and safe to count here.
 */
export function useWordDoubleTap(
  onDoubleTap: (key: string, element: HTMLElement) => void,
  shouldIgnore?: () => boolean,
) {
  const last = useRef<{ key: string; at: number } | null>(null);

  return useCallback(
    (event: ReactMouseEvent) => {
      if (shouldIgnore?.()) {
        last.current = null;
        return;
      }

      const element = (event.target as HTMLElement)?.closest?.<HTMLElement>('[data-key]');
      if (!element) {
        last.current = null;
        return;
      }

      const key = element.dataset.key!;
      const now = Date.now();

      if (last.current && last.current.key === key && now - last.current.at < WINDOW_MS) {
        last.current = null;
        onDoubleTap(key, element);
        return;
      }
      last.current = { key, at: now };
    },
    [onDoubleTap, shouldIgnore],
  );
}
