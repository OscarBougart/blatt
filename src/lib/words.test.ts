import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import { filterWords, matchesQuery, sortWords, truncateSentence } from './words';

function makeWord(overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    id: 'w1',
    surface: 'Häusern',
    lemma: 'Haus',
    definition: 'house, building',
    sentence: 'Er ging zu den Häusern.',
    charOffset: 15,
    docId: 'doc1',
    paragraphIndex: 0,
    createdAt: 1000,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    dueAt: 1000,
    lapses: 0,
    ...overrides,
  };
}

describe('matchesQuery', () => {
  it('matches the surface form', () => {
    expect(matchesQuery(makeWord(), 'häus')).toBe(true);
  });

  it('folds umlauts, so haus finds Häusern', () => {
    expect(matchesQuery(makeWord(), 'haus')).toBe(true);
  });

  it('matches the definition', () => {
    expect(matchesQuery(makeWord(), 'building')).toBe(true);
  });

  it('matches the reader’s own note', () => {
    expect(matchesQuery(makeWord({ note: 'mein Wort' }), 'mein')).toBe(true);
  });

  it('folds eszett', () => {
    expect(matchesQuery(makeWord({ lemma: 'groß' }), 'gross')).toBe(true);
  });

  it('returns everything for an empty query', () => {
    expect(matchesQuery(makeWord(), '   ')).toBe(true);
  });

  it('rejects a genuine miss', () => {
    expect(matchesQuery(makeWord(), 'zebra')).toBe(false);
  });
});

describe('filterWords', () => {
  const words = [
    makeWord({ id: 'a', docId: 'doc1', surface: 'Haus' }),
    makeWord({ id: 'b', docId: 'doc2', surface: 'Baum', lemma: 'Baum', definition: 'tree' }),
    makeWord({ id: 'c', docId: 'doc1', surface: 'Katze', lemma: 'Katze', definition: '' }),
  ];

  it('filters by document', () => {
    expect(filterWords(words, { query: '', docId: 'doc1' }).map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('filters by query', () => {
    expect(filterWords(words, { query: 'tree', docId: 'all' }).map((w) => w.id)).toEqual(['b']);
  });

  it('combines document and query', () => {
    expect(filterWords(words, { query: 'katze', docId: 'doc1' }).map((w) => w.id)).toEqual(['c']);
  });
});

describe('sortWords', () => {
  it('sorts newest first', () => {
    const words = [makeWord({ id: 'old', createdAt: 1 }), makeWord({ id: 'new', createdAt: 9 })];
    expect(sortWords(words).map((w) => w.id)).toEqual(['new', 'old']);
  });

  it('does not mutate the input', () => {
    const words = [makeWord({ id: 'a', createdAt: 1 }), makeWord({ id: 'b', createdAt: 2 })];
    sortWords(words);
    expect(words.map((w) => w.id)).toEqual(['a', 'b']);
  });
});

describe('truncateSentence', () => {
  it('leaves a short sentence alone', () => {
    expect(truncateSentence('Er ging.')).toBe('Er ging.');
  });

  it('collapses whitespace', () => {
    expect(truncateSentence('Er   ging\n weg.')).toBe('Er ging weg.');
  });

  it('truncates with an ellipsis', () => {
    expect(truncateSentence('a'.repeat(100), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});
