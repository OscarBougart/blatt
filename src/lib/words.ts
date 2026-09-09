import type { SavedWord } from '@/db/types';

export interface WordFilter {
  query: string;
  docId: string | 'all';
}

/** Case- and umlaut-insensitive haystack matching. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

/**
 * Search across surface form, lemma, definition and the reader's own note.
 *
 * Searching `haus` should find `Häusern`, so both sides are folded.
 */
export function matchesQuery(word: SavedWord, query: string): boolean {
  const needle = normalise(query.trim());
  if (!needle) return true;

  return [word.surface, word.lemma, word.definition, word.note ?? '']
    .map(normalise)
    .some((field) => field.includes(needle));
}

export function filterWords(words: SavedWord[], filter: WordFilter): SavedWord[] {
  return words.filter((word) => {
    if (filter.docId !== 'all' && word.docId !== filter.docId) return false;
    return matchesQuery(word, filter.query);
  });
}

/**
 * Newest first, always. The list is a record of what you have read, and the
 * word you saved this morning is the one you are looking for.
 */
export function sortWords(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => b.createdAt - a.createdAt);
}

/** One line of context for a collapsed row. */
export function truncateSentence(sentence: string, limit = 80): string {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}
