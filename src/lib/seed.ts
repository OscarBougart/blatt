import { db } from '@/db/db';
import type { Doc, SavedWord } from '@/db/types';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { newId } from '@/lib/id';

/**
 * The demo document, installed on first run.
 *
 * The whole point is that a stranger who taps a link is reading within
 * seconds: no import, no onboarding, no wait, and no network. Every expensive
 * thing — alignment, the lemma map, every definition — was computed at build
 * time by scripts/build-seed.test.ts and ships as one JSON file the service
 * worker precaches.
 */

export interface SeedFile {
  title: string;
  theme: string;
  source: { de: string; en: string };
  pairs: { de: string; en: string }[];
  lemmaMap: Record<string, LemmaCandidate[]>;
  dict: { lemma: string; definitions: string[] }[];
  words: {
    surface: string;
    lemma: string;
    definition: string;
    sentence: string;
    charOffset: number;
    paragraphIndex: number;
  }[];
}

/** Marks a database as seeded, so a reader who deletes the demo keeps it gone. */
export const SEEDED_KEY = 'blatt:seeded';

function alreadySeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeeded() {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    // Private mode. Worst case the demo is installed again on next launch.
  }
}

/**
 * Turn the seed file into rows.
 *
 * Pure, so the shape of what gets written can be checked without a database.
 * The six words are due immediately: a review screen that opens on "Nothing
 * due" shows a visitor an empty box and tells them nothing about the app.
 */
export function seedRows(seed: SeedFile, now: number, id: () => string) {
  const docId = id();

  const doc: Doc = {
    id: docId,
    title: seed.title,
    theme: seed.theme,
    pairs: seed.pairs,
    lemmaMap: seed.lemmaMap,
    lastParagraphIndex: 0,
    createdAt: now,
  };

  const words: SavedWord[] = seed.words.map((word) => ({
    id: id(),
    surface: word.surface,
    lemma: word.lemma,
    definition: word.definition,
    sentence: word.sentence,
    charOffset: word.charOffset,
    docId,
    paragraphIndex: word.paragraphIndex,
    createdAt: now,
    // Introduced, not queued. The demo's six words are meant to be a deck
    // waiting to be reviewed — putting them behind the daily new-word limit
    // would leave a first-time visitor with an empty review screen, which is
    // the one thing seeding them was for.
    introducedAt: now,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    dueAt: now,
    lapses: 0,
  }));

  const dict = seed.dict.map((entry) => ({
    lemma: entry.lemma,
    definitions: entry.definitions,
    fetchedAt: now,
    source: 'wiktionary' as const,
  }));

  return { doc, words, dict };
}

/**
 * Install the demo, once, into an empty database.
 *
 * Deliberately silent about failure. If the seed cannot be fetched the app is
 * simply empty, which is the correct state for a returning reader anyway — it
 * must never be an error message on top of a first impression.
 */
export async function installSeed(): Promise<void> {
  if (alreadySeeded()) return;
  if ((await db.docs.count()) > 0) {
    markSeeded();
    return;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}seed.json`);
    if (!response.ok) return;
    const seed = (await response.json()) as SeedFile;
    const { doc, words, dict } = seedRows(seed, Date.now(), newId);

    await db.transaction('rw', [db.docs, db.words, db.dict], async () => {
      // Checked again inside the transaction: two tabs opened at once would
      // otherwise both pass the count above and install the demo twice.
      if ((await db.docs.count()) > 0) return;
      await db.docs.add(doc);
      await db.words.bulkAdd(words);
      await db.dict.bulkPut(dict);
    });

    markSeeded();
  } catch {
    // Offline on a first visit with no cached seed. Nothing to show, no harm.
  }
}
