import type { SavedWord } from '@/db/types';

/**
 * What a review session is made of.
 *
 * A saved word is not a card until a round introduces it. There is no daily
 * cap on how many: the reader chose the size of the round, and they get it.
 *
 * Nothing here gates a session on a due date. A card's due date orders the
 * deck — soonest first, so a word graded Hard comes back round sooner than one
 * graded Easy — but it never withholds a card. The reader opens Review when
 * they want to, and there is always something to review. This app does not set
 * homework.
 *
 * All pure. The caller does the writing.
 */

/**
 * How much of a round new words take when there are cards enough to fill the
 * rest: half, so a round is neither all strangers nor all old friends.
 */
const FRESH_SHARE = 0.5;

/** A card: introduced, and not suspended. */
export function isCard(word: SavedWord): boolean {
  return word.introducedAt !== undefined && !word.suspended;
}

/** Saved, but not yet a card. The queue. */
export function isWaiting(word: SavedWord): boolean {
  return word.introducedAt === undefined && !word.suspended;
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
 * rarely. Nothing is withheld for not being due yet: if the reader wants a
 * fourth round tonight they get one, drawn from whatever is least well known.
 *
 * New words take half the round, and more whenever there are not enough cards
 * in review to fill it. The round is only ever short when there are not that
 * many words saved.
 */
export function reviewSession(words: SavedWord[], options: { limit: number }): Session {
  const { limit } = options;

  // Oldest first: a word saved three weeks ago has waited longer, and the
  // sentence it came from is the one furthest from memory.
  const waiting = words.filter(isWaiting).sort((a, b) => a.createdAt - b.createdAt);
  const inReview = words.filter(isCard).sort((a, b) => a.dueAt - b.dueAt);

  const freshCount = Math.max(Math.ceil(limit * FRESH_SHARE), limit - inReview.length);
  const fresh = waiting.slice(0, freshCount);
  const cards = inReview.slice(0, limit - fresh.length);

  return { cards, fresh };
}
