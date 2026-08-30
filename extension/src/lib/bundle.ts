import type { Doc, SavedWord } from '@app/db/types';
import type { LemmaCandidate } from '@app/lib/lemma/types';
import { newId } from '@app/lib/id';

/**
 * The handoff file.
 *
 * The extension and the hosted app are different origins and cannot share an
 * IndexedDB, so v1 does the dull thing: it writes exactly the file Blatt's own
 * backup export produces, and the reader imports it through the existing path.
 * No new import code, no new format to keep in step — if this drifts from the
 * app's `Backup` type, the fix belongs in whichever one is wrong, not in a
 * translation layer between them.
 */

/** Must match `FORMAT` and `VERSION` in src/lib/backup.ts. */
export const FORMAT = 'blatt-backup';
export const VERSION = 2;

export interface CapturedWord {
  surface: string;
  lemma: string;
  definition: string;
  sentence: string;
  charOffset: number;
  /** Where it was read, for the record. */
  url: string;
  title: string;
  createdAt: number;
}

export interface BundleInput {
  title: string;
  theme: string;
  pairs: { de: string; en: string }[];
  lemmaMap: Record<string, LemmaCandidate[]>;
  definitions: { lemma: string; definitions: string[] }[];
  words: CapturedWord[];
  now: number;
  id?: () => string;
}

/**
 * Build the import file for one captured article.
 *
 * Words saved while reading the page ride along in the same file, pointed at
 * the document they came from. They arrive with no `introducedAt`, so they
 * enter the queue and are paced by the daily limit like anything else — a
 * capture cannot flood next week's reviews.
 */
export function buildBundle(input: BundleInput) {
  const id = input.id ?? newId;
  const docId = id();

  const doc: Doc = {
    id: docId,
    title: input.title,
    theme: input.theme,
    pairs: input.pairs,
    lemmaMap: input.lemmaMap,
    lastParagraphIndex: 0,
    createdAt: input.now,
  };

  const words: SavedWord[] = input.words.map((word) => ({
    id: id(),
    surface: word.surface,
    lemma: word.lemma,
    definition: word.definition,
    sentence: word.sentence,
    charOffset: word.charOffset,
    docId,
    // The sentence came from the page, not from a paragraph of the captured
    // document, so there is no honest index to give. Zero is the one value
    // that cannot point at the wrong paragraph.
    paragraphIndex: 0,
    createdAt: word.createdAt,
    cardMode: 'recognition',
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    dueAt: word.createdAt,
    lapses: 0,
  }));

  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: input.now,
    docs: [doc],
    words,
    dict: input.definitions
      .filter((entry) => entry.definitions.length > 0)
      .map((entry) => ({
        lemma: entry.lemma,
        definitions: entry.definitions,
        fetchedAt: input.now,
        source: 'wiktionary' as const,
      })),
    sessions: [],
    forms: [],
    reviews: [],
    sightings: [],
  };
}

/** blatt-der-froschkoenig-2026-08-30.json — sorts and reads sensibly. */
export function bundleFilename(title: string, at: number): string {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  const date = new Date(at).toISOString().slice(0, 10);
  return `blatt-${slug || 'capture'}-${date}.json`;
}
