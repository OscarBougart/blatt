import { useEffect } from 'react';

/** A paragraph must be current this long before it counts as read. */
export const DWELL_MS = 1500;

/**
 * Calls `onDwell(index)` once `index` has been continuously current for
 * `DWELL_MS`.
 *
 * The threshold is the point of the whole thing: without it, scrolling fast
 * through a text inflates the denominator of the flip rate and the number
 * flatters you. A paragraph you scrolled past in 200ms was not read.
 *
 * Changing `index` clears the pending timer, so the dwell must be continuous.
 */
export function useDwell(
  index: number,
  active: boolean,
  onDwell: (index: number) => void,
  ms: number = DWELL_MS,
) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => onDwell(index), ms);
    return () => clearTimeout(timer);
  }, [index, active, onDwell, ms]);
}
