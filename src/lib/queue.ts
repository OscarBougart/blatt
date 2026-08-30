import type { SavedWord } from '@/db/types';
import { dueWords, shuffle } from './srs';

/**
 * What a review session is made of.
 *
 * Blatt took the friction out of saving a word, and with it the brake that
 * stops Anki users burying themselves. You can tap eighty words in one evening
 * here and drown a fortnight later, so the limit matters more than it does in
 * Anki, not less: a saved word is not a card until it is introduced, and only
 * a handful are introduced a day.
 *
 * All pure. The caller does the writing.
 */

/** Default new cards a day. The received range is five to ten. */
export const DEFAULT_NEW_PER_DAY = 8;
export const MIN_NEW_PER_DAY = 3;
export const MAX_NEW_PER_DAY = 20;

/** One sitting. Long enough to be worth doing, short enough to finish. */
export const SESSION_CAP = 20;

export function clampNewPerDay(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NEW_PER_DAY;
  return Math.min(MAX_NEW_PER_DAY, Math.max(MIN_NEW_PER_DAY, Math.round(value)));
}

/** Local midnight. The day rolls over where the reader lives, not in UTC. */
export function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** A card: introduced, and not suspended. */
export function isCard(word: SavedWord): boolean {
  return word.introducedAt !== undefined && !word.suspended;
}

/** Saved, but not yet a card. The queue. */
export function isWaiting(word: SavedWord): boolean {
  return word.introducedAt === undefined && !word.suspended;
}

/** How many cards were introduced today, against the daily allowance. */
export function introducedToday(words: SavedWord[], now: number): number {
  const midnight = startOfDay(now);
  return words.filter((w) => w.introducedAt !== undefined && w.introducedAt >= midnight).length;
}

export interface Session {
  /** Cards already in review and due now. */
  due: SavedWord[];
  /** Words being introduced by this session. The caller stamps them. */
  fresh: SavedWord[];
}

/**
 * Compose a session: everything due, then new words up to what is left of
 * today's allowance, the whole thing capped.
 *
 * Due cards come first and are never displaced. Falling behind on review is
 * the failure mode that ends the habit, so the backlog outranks the appetite
 * for new words — if twenty cards are due, today's new words wait.
 */
export function composeSession(
  words: SavedWord[],
  options: { newPerDay: number; now: number; cap?: number; random?: () => number },
): Session {
  const { newPerDay, now, cap = SESSION_CAP, random } = options;

  const due = shuffle(dueWords(words.filter(isCard), now), random).slice(0, cap);

  const allowance = Math.max(0, clampNewPerDay(newPerDay) - introducedToday(words, now));
  const room = Math.max(0, cap - due.length);

  // Oldest first: a word saved three weeks ago has waited longer, and the
  // sentence it came from is the one furthest from memory.
  const fresh = words
    .filter(isWaiting)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.min(allowance, room));

  return { due, fresh };
}
