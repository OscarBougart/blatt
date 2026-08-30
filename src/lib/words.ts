import type { LemmaCandidate } from '@/lib/lemma/types';
import { CONFIDENT } from '@/lib/lemma/cascade';
import type { SavedWord } from '@/db/types';

export type SortMode = 'recent' | 'overdue';

export interface WordFilter {
  query: string;
  docId: string | 'all';
  needsAttention: boolean;
}

/**
 * Confidence the cascade had in the lemma this word actually uses.
 *
 * Returns null when the document's map has nothing to say — an older document,
 * or a lemma the reader typed in themselves.
 */
export function lemmaConfidence(
  word: Pick<SavedWord, 'surface' | 'lemma'>,
  candidates: LemmaCandidate[] | undefined,
): number | null {
  if (!candidates?.length) return null;
  const match = candidates.find((c) => c.lemma === word.lemma);
  return match ? match.confidence : null;
}

/**
 * Words worth a second look: a leech, no definition, a lookup that failed, or
 * a lemma the cascade was only guessing at.
 *
 * Deliberately narrow. This is meant to be a two-minute job done occasionally,
 * and a filter that flags half the list is a chore nobody does.
 */
export function needsAttention(
  word: SavedWord,
  candidates: LemmaCandidate[] | undefined,
): boolean {
  // A leech belongs here above everything else. Six failures says the card is
  // wrong — the sentence too long, or the context giving nothing away — and
  // the fix is to rebuild it, which is work that happens on this screen.
  if (word.leechFlaggedAt !== undefined) return true;
  if (word.lookupFailed) return true;
  if (!word.definition.trim() && !word.note?.trim()) return true;

  const confidence = lemmaConfidence(word, candidates);
  return confidence !== null && confidence < CONFIDENT;
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

export function filterWords(
  words: SavedWord[],
  filter: WordFilter,
  candidatesFor: (word: SavedWord) => LemmaCandidate[] | undefined,
): SavedWord[] {
  return words.filter((word) => {
    if (filter.docId !== 'all' && word.docId !== filter.docId) return false;
    if (filter.needsAttention && !needsAttention(word, candidatesFor(word))) return false;
    return matchesQuery(word, filter.query);
  });
}

/**
 * `recent` is newest first. `overdue` is most overdue first — words not yet due
 * sort last, because a list of things that need doing should start with the
 * thing most overdue.
 */
export function sortWords(words: SavedWord[], mode: SortMode, now = Date.now()) {
  const sorted = [...words];
  if (mode === 'recent') {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    sorted.sort((a, b) => now - b.dueAt - (now - a.dueAt));
  }
  return sorted;
}

/** One line of context for a collapsed row. */
export function truncateSentence(sentence: string, limit = 80): string {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}
