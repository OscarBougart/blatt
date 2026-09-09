import type { SavedWord } from '@/db/types';

/**
 * What a review session is made of.
 *
 * Blatt took the friction out of saving a word, and with it the brake that
 * stops Anki users burying themselves. You can tap eighty words in one evening
 * here, so a saved word is not a card until it is introduced, and only a
 * handful are introduced a day.
 *
 * Nothing here gates a session on a due date. A card's due date orders the
 * deck — soonest first, so a word graded Hard comes back round sooner than one
 * graded Easy — but it never withholds a card. The reader opens Review when
 * they want to, and there is always something to review. This app does not set
 * homework.
 *
 * All pure. The caller does the writing.
 */

/** Default new cards a day. The received range is five to ten. */
export const DEFAULT_NEW_PER_DAY = 8;
export const MIN_NEW_PER_DAY = 3;
export const MAX_NEW_PER_DAY = 20;

/** How much of a round may be words the reader has never seen. */
const FRESH_SHARE = 0.5;

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

/**
 * How a session asks its questions.
 *
 * `sentence` uses the word's own card mode — the sentence it was read in,
 * with the word marked, or blanked if it has been promoted to cloze.
 * `word` drops the context entirely: the English definition on the front and
 * the German word behind it, which is the drill you want when you already
 * know the sentence by heart and are testing the word itself.
 */
export type SessionStyle = 'sentence' | 'word';

export interface Session {
  /** Cards already in review, soonest due first. */
  cards: SavedWord[];
  /** Words being introduced by this round. The caller stamps them. */
  fresh: SavedWord[];
}

/**
 * Draw a round of `limit` cards.
 *
 * Soonest due first, which is the whole use the due date is put to: SM-2 books
 * a card graded Hard back for tomorrow and one graded Easy for next month, so
 * ordering by `dueAt` makes the hard words come round often and the easy ones
 * rarely. Nothing is withheld for not being due yet — if the reader wants a
 * fourth round tonight they get one, drawn from whatever is least well known.
 *
 * New words are still rationed. That limit is not homework: it is the brake on
 * how fast the deck grows, and it takes at most half a round so a session is
 * never all strangers.
 */
export function reviewSession(
  words: SavedWord[],
  options: { limit: number; newPerDay: number; now: number },
): Session {
  const { limit, newPerDay, now } = options;

  const allowance = Math.max(0, clampNewPerDay(newPerDay) - introducedToday(words, now));
  const room = Math.min(allowance, Math.ceil(limit * FRESH_SHARE));

  // Oldest first: a word saved three weeks ago has waited longer, and the
  // sentence it came from is the one furthest from memory.
  const fresh = words
    .filter(isWaiting)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, room);

  const cards = words
    .filter(isCard)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit - fresh.length);

  return { cards, fresh };
}
