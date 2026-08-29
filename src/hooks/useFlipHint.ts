import { useCallback, useEffect, useState } from 'react';

/** Set once the reader has flipped to English, ever. */
export const FLIPPED_KEY = 'blatt:flipped';

/** Long enough for the first paragraph to be read, not long enough to miss. */
const DELAY_MS = 1600;

/** How long the page stays pulled aside. */
const HOLD_MS = 620;

/** How far the page slides. Enough to see English behind it, not enough to read. */
export const HINT_SHIFT = '-7%';

function hasFlipped(): boolean {
  try {
    return localStorage.getItem(FLIPPED_KEY) === '1';
  } catch {
    return true; // No storage: assume it has been seen, rather than nag forever.
  }
}

/**
 * The one-time nudge that teaches the flip.
 *
 * A first-time visitor cannot see that a second layer exists — there is no
 * chrome on the reading screen and there never will be. So the page shows
 * them: shortly after the text settles, it slides a little to the left,
 * uncovers a sliver of English, and comes back.
 *
 * This is an affordance, not a tutorial. It demonstrates the gesture in the
 * medium the gesture happens in, says nothing, and never happens again once
 * the reader has flipped once.
 */
export function useFlipHint(ready: boolean) {
  const [hinting, setHinting] = useState(false);
  const [pending, setPending] = useState(() => !hasFlipped());

  useEffect(() => {
    if (!ready || !pending) return;

    const show = setTimeout(() => setHinting(true), DELAY_MS);
    const hide = setTimeout(() => setHinting(false), DELAY_MS + HOLD_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [ready, pending]);

  /** Called on the first real flip: the lesson has landed, retire it. */
  const seen = useCallback(() => {
    setHinting(false);
    setPending(false);
    try {
      localStorage.setItem(FLIPPED_KEY, '1');
    } catch {
      // Nothing to do. The hint is cosmetic.
    }
  }, []);

  return { hinting, seen };
}
