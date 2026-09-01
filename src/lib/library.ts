import { db } from '@/db/db';
import type { Doc } from '@/db/types';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { newId } from '@/lib/id';

/**
 * The starter library: texts that ship with the app, added on request.
 *
 * A stranger installs Blatt and has nothing to read. The import form asks for
 * a German text *and* its English translation, which is precisely what a
 * learner does not have — so the library is the difference between an app
 * that demonstrates itself and an empty box with a form in it.
 *
 * Everything expensive was done at build time by scripts/build-library.test.ts:
 * paragraphs aligned, every form lemmatised, every definition fetched. Adding
 * a text here is two fetches and a transaction, and works offline once the
 * service worker has the files.
 *
 * The dictionary is one shared file rather than a copy per text, because
 * definitions are most of the bytes and every tale reuses the same few
 * thousand words.
 */

export interface LibraryEntry {
  slug: string;
  title: string;
  theme: string;
  /** The edition it was taken from, shown so the provenance is not a mystery. */
  source: string;
  paragraphs: number;
  words: number;
}

export interface LibraryText {
  slug: string;
  title: string;
  theme: string;
  source: string;
  pairs: { de: string; en: string }[];
  lemmaMap: Record<string, LemmaCandidate[]>;
}

export interface LibraryDict {
  lemma: string;
  definitions: string[];
}

const base = () => import.meta.env.BASE_URL;

/**
 * What the library holds. An empty list is a valid answer — a build that has
 * not been run yet, or a first visit with no network and nothing cached — and
 * must render as "nothing here", never as an error.
 */
export async function fetchLibraryIndex(): Promise<LibraryEntry[]> {
  try {
    const response = await fetch(`${base()}library/index.json`);
    if (!response.ok) return [];
    return (await response.json()) as LibraryEntry[];
  } catch {
    return [];
  }
}

/**
 * The rows one library text becomes.
 *
 * Pure, so what gets written can be checked without a database. Only the
 * definitions this text actually uses are returned: the shared dictionary
 * covers the whole library, and writing all of it for one tale would put
 * thousands of words a reader has never met into their database.
 */
export function libraryRows(
  text: LibraryText,
  dict: LibraryDict[],
  now: number,
  id: () => string,
) {
  const doc: Doc = {
    id: id(),
    title: text.title,
    theme: text.theme,
    pairs: text.pairs,
    lemmaMap: text.lemmaMap,
    lastParagraphIndex: 0,
    createdAt: now,
    librarySlug: text.slug,
  };

  const used = new Set(
    Object.values(text.lemmaMap)
      .map((candidates) => candidates[0]?.lemma)
      .filter((lemma): lemma is string => Boolean(lemma)),
  );

  const entries = dict
    .filter((entry) => used.has(entry.lemma))
    .map((entry) => ({
      lemma: entry.lemma,
      definitions: entry.definitions,
      fetchedAt: now,
      source: 'wiktionary' as const,
    }));

  return { doc, dict: entries };
}

/**
 * Add a library text to the reader's own library.
 *
 * Returns the new document's id, so the caller can open it. A text already
 * added is returned as it stands rather than duplicated — the list disables
 * the button, but two taps in quick succession must not make two copies.
 */
export async function installLibraryText(slug: string): Promise<string> {
  const existing = await db.docs.filter((doc) => doc.librarySlug === slug).first();
  if (existing) return existing.id;

  const [textResponse, dictResponse] = await Promise.all([
    fetch(`${base()}library/${slug}.json`),
    fetch(`${base()}library/dict.json`),
  ]);
  if (!textResponse.ok) throw new Error('That text could not be loaded.');

  const text = (await textResponse.json()) as LibraryText;
  // A missing dictionary is survivable: the text reads, and a tapped word
  // falls back to the same lookup any imported document would make.
  const dict = dictResponse.ok ? ((await dictResponse.json()) as LibraryDict[]) : [];

  const rows = libraryRows(text, dict, Date.now(), newId);

  await db.transaction('rw', [db.docs, db.dict], async () => {
    const again = await db.docs.filter((doc) => doc.librarySlug === slug).first();
    if (again) return;
    await db.docs.add(rows.doc);
    await db.dict.bulkPut(rows.dict);
  });

  const saved = await db.docs.filter((doc) => doc.librarySlug === slug).first();
  return saved?.id ?? rows.doc.id;
}
