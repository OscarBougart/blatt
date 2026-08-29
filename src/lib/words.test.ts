import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import type { LemmaCandidate } from '@/lib/lemma/types';
import {
  filterWords,
  lemmaConfidence,
  matchesQuery,
  needsAttention,
  sortWords,
  truncateSentence,
} from './words';

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

const candidates = (...list: [string, number][]): LemmaCandidate[] =>
  list.map(([lemma, confidence]) => ({ lemma, confidence, method: 'suffix' }));

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

describe('lemmaConfidence', () => {
  it('finds the confidence of the lemma in use', () => {
    expect(lemmaConfidence(makeWord(), candidates(['Haus', 0.95], ['Hause', 0.4]))).toBe(
      0.95,
    );
  });

  it('is null when the document knows nothing about it', () => {
    expect(lemmaConfidence(makeWord(), undefined)).toBeNull();
  });

  it('is null for a hand-typed lemma not among the candidates', () => {
    expect(lemmaConfidence(makeWord({ lemma: 'Eigenwort' }), candidates(['Haus', 0.9]))).toBeNull();
  });
});

describe('needsAttention', () => {
  it('flags a failed lookup', () => {
    expect(needsAttention(makeWord({ lookupFailed: true }), candidates(['Haus', 1]))).toBe(
      true,
    );
  });

  it('flags an empty definition', () => {
    expect(needsAttention(makeWord({ definition: '' }), candidates(['Haus', 1]))).toBe(true);
  });

  it('does not flag an empty definition the reader has annotated', () => {
    expect(
      needsAttention(makeWord({ definition: '', note: 'my own gloss' }), candidates(['Haus', 1])),
    ).toBe(false);
  });

  it('flags a low-confidence lemma', () => {
    expect(needsAttention(makeWord(), candidates(['Haus', 0.5]))).toBe(true);
  });

  it('leaves a confident, defined word alone', () => {
    expect(needsAttention(makeWord(), candidates(['Haus', 0.95]))).toBe(false);
  });

  it('does not flag a hand-typed lemma just because it is unknown', () => {
    expect(needsAttention(makeWord({ lemma: 'Eigenwort' }), candidates(['Haus', 0.9]))).toBe(
      false,
    );
  });
});

describe('filterWords', () => {
  const words = [
    makeWord({ id: 'a', docId: 'doc1', surface: 'Haus' }),
    makeWord({ id: 'b', docId: 'doc2', surface: 'Baum', lemma: 'Baum', definition: 'tree' }),
    makeWord({ id: 'c', docId: 'doc1', surface: 'Katze', lemma: 'Katze', definition: '' }),
  ];
  const none = () => undefined;

  it('filters by document', () => {
    const result = filterWords(words, { query: '', docId: 'doc1', needsAttention: false }, none);
    expect(result.map((w) => w.id)).toEqual(['a', 'c']);
  });

  it('filters by query', () => {
    const result = filterWords(words, { query: 'tree', docId: 'all', needsAttention: false }, none);
    expect(result.map((w) => w.id)).toEqual(['b']);
  });

  it('filters to words needing attention', () => {
    const result = filterWords(words, { query: '', docId: 'all', needsAttention: true }, none);
    expect(result.map((w) => w.id)).toEqual(['c']);
  });

  it('combines filters', () => {
    const result = filterWords(
      words,
      { query: 'katze', docId: 'doc1', needsAttention: true },
      none,
    );
    expect(result.map((w) => w.id)).toEqual(['c']);
  });
});

describe('sortWords', () => {
  it('sorts recent newest first', () => {
    const words = [makeWord({ id: 'old', createdAt: 1 }), makeWord({ id: 'new', createdAt: 9 })];
    expect(sortWords(words, 'recent').map((w) => w.id)).toEqual(['new', 'old']);
  });

  it('sorts overdue most-overdue first', () => {
    const words = [
      makeWord({ id: 'soon', dueAt: 900 }),
      makeWord({ id: 'ancient', dueAt: 100 }),
      makeWord({ id: 'future', dueAt: 5000 }),
    ];
    expect(sortWords(words, 'overdue', 1000).map((w) => w.id)).toEqual([
      'ancient',
      'soon',
      'future',
    ]);
  });

  it('does not mutate the input', () => {
    const words = [makeWord({ id: 'a', createdAt: 1 }), makeWord({ id: 'b', createdAt: 2 })];
    sortWords(words, 'recent');
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
