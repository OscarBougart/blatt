import type { SessionStyle } from '@/lib/queue';

/**
 * What the reader chose last time.
 *
 * Both questions used to be asked before every single round, which made
 * starting a review a three-tap errand for an answer that almost never
 * changed. They are remembered now and shown back on the start screen, where
 * changing them is one tap away and skipping them is none.
 */

const STYLE_KEY = 'blatt:review-style';
const LIMIT_KEY = 'blatt:review-limit';

/** The lengths the picker offers. Anything else is ignored on read. */
export const LIMITS = [5, 10, 20] as const;

export function readStyle(): SessionStyle | null {
  try {
    const stored = localStorage.getItem(STYLE_KEY);
    if (stored === 'sentence' || stored === 'word') return stored;
  } catch {
    // Private mode, storage disabled. Ask, as the app always used to.
  }
  return null;
}

export function readLimit(): number | null {
  try {
    const stored = Number(localStorage.getItem(LIMIT_KEY));
    if ((LIMITS as readonly number[]).includes(stored)) return stored;
  } catch {
    // As above.
  }
  return null;
}

export function writeStyle(style: SessionStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    // The preference is a convenience. Losing it costs two taps.
  }
}

export function writeLimit(limit: number): void {
  try {
    localStorage.setItem(LIMIT_KEY, String(limit));
  } catch {
    // As above.
  }
}

/** How a remembered choice reads back on the start screen. */
export const STYLE_LABEL: Record<SessionStyle, string> = {
  sentence: 'In context',
  word: 'Word only',
};
