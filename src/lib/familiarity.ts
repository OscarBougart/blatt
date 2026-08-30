import type { ReviewLog, SavedWord, Sighting } from '@/db/types';

/**
 * What the reader already knows.
 *
 * Two quite different kinds of evidence, deliberately treated as equal.
 *
 * A word can be familiar because it has been reviewed and stuck. It can also
 * be familiar because it was read past, repeatedly, without ever being tapped
 * — which is the more common case by far and the one no flashcard app ever
 * notices. If you have read three separate paragraphs containing a word and
 * never once wanted to know what it meant, you know what it means.
 *
 * All pure. Epic 10 depends on this, so it is worth being able to reason about
 * without a database in the room.
 */

/** Reviews needed before a word counts as learned. */
export const FAMILIAR_REPETITIONS = 2;

/** A lapse inside this window disqualifies a word, however many reps it has. */
export const LAPSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Paragraphs a word must survive unremarked before it counts as known. */
export const FAMILIAR_SIGHTINGS = 3;

/** A grade of Again. Anything lower than Hard is a failure. */
const AGAIN = 1;

/**
 * When a word was last failed, from its review log. Null if never.
 *
 * Reads the log rather than the word because `SavedWord.lapses` is a count
 * with no date attached: it can say a word has lapsed four times but not
 * whether any of that was recent, and recency is the whole question here.
 */
export function lastLapseAt(logs: ReviewLog[]): number | null {
  let latest: number | null = null;
  for (const log of logs) {
    if (log.grade > AGAIN) continue;
    if (latest === null || log.reviewedAt > latest) latest = log.reviewedAt;
  }
  return latest;
}

/** Rule one: reviewed enough, and not recently forgotten. */
export function familiarFromReview(
  word: Pick<SavedWord, 'repetitions'> | undefined,
  lapsedAt: number | null,
  now: number,
): boolean {
  if (!word || word.repetitions < FAMILIAR_REPETITIONS) return false;
  if (lapsedAt !== null && now - lapsedAt < LAPSE_WINDOW_MS) return false;
  return true;
}

/** Rule two: read past often enough, and never worth saving. */
export function familiarFromSightings(
  sighting: Pick<Sighting, 'count'> | undefined,
  saved: boolean,
): boolean {
  if (saved) return false;
  return (sighting?.count ?? 0) >= FAMILIAR_SIGHTINGS;
}

export interface FamiliaritySources {
  words: SavedWord[];
  sightings: Sighting[];
  logs: ReviewLog[];
}

/**
 * Build the lookup.
 *
 * Everything is indexed once and answered from memory afterwards, because the
 * caller is a render path and this question gets asked per word on screen.
 */
export function buildFamiliarity(
  { words, sightings, logs }: FamiliaritySources,
  now: number,
): (lemma: string) => boolean {
  const logsByWord = new Map<string, ReviewLog[]>();
  for (const log of logs) {
    const list = logsByWord.get(log.wordId);
    if (list) list.push(log);
    else logsByWord.set(log.wordId, [log]);
  }

  // A lemma can carry several saved words — the same word met in two texts.
  // It counts as familiar if any one of them qualifies.
  const familiar = new Set<string>();
  const saved = new Set<string>();

  for (const word of words) {
    saved.add(word.lemma);
    if (familiarFromReview(word, lastLapseAt(logsByWord.get(word.id) ?? []), now)) {
      familiar.add(word.lemma);
    }
  }

  for (const sighting of sightings) {
    if (familiarFromSightings(sighting, saved.has(sighting.lemma))) {
      familiar.add(sighting.lemma);
    }
  }

  return (lemma: string) => familiar.has(lemma);
}
