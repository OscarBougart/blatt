import { describe, expect, it } from 'vitest';
import { seedRows, type SeedFile } from './seed';

const NOW = 1_700_000_000_000;

function ids() {
  let n = 0;
  return () => `id${n++}`;
}

const seed: SeedFile = {
  title: 'Der Froschkönig',
  theme: 'Märchen',
  source: { de: 'de-title', en: 'en-title' },
  pairs: [{ de: 'Ein Blatt fiel.', en: 'A leaf fell.' }],
  lemmaMap: { fiel: [{ lemma: 'fallen', confidence: 0.9, method: 'wiktionary' }] },
  dict: [{ lemma: 'fallen', definitions: ['verb: to fall'] }],
  words: [
    {
      surface: 'fiel',
      lemma: 'fallen',
      definition: 'verb: to fall',
      sentence: 'Ein Blatt fiel.',
      charOffset: 10,
      paragraphIndex: 0,
    },
  ],
};

describe('seedRows', () => {
  it('builds a document carrying its precomputed lemma map', () => {
    const { doc } = seedRows(seed, NOW, ids());
    expect(doc.title).toBe('Der Froschkönig');
    expect(doc.pairs).toHaveLength(1);
    expect(doc.lemmaMap.fiel[0].lemma).toBe('fallen');
    expect(doc.lastParagraphIndex).toBe(0);
  });

  it('points the saved words at the document it just made', () => {
    const { doc, words } = seedRows(seed, NOW, ids());
    expect(words[0].docId).toBe(doc.id);
    expect(words[0].id).not.toBe(doc.id);
  });

  it('seeds cards, not queue entries', () => {
    // A word with no introducedAt waits behind the daily limit, which would
    // leave the demo's review screen empty on a first visit.
    const { words } = seedRows(seed, NOW, ids());
    expect(words[0].introducedAt).toBe(NOW);
  });

  it('makes every seeded word due now, with fresh SM-2 state', () => {
    const { words } = seedRows(seed, NOW, ids());
    expect(words[0].dueAt).toBe(NOW);
    expect(words[0].ease).toBe(2.5);
    expect(words[0].repetitions).toBe(0);
    expect(words[0].interval).toBe(0);
    expect(words[0].lapses).toBe(0);
  });

  it('carries the definition, so the demo needs no network', () => {
    const { words, dict } = seedRows(seed, NOW, ids());
    expect(words[0].definition).toBe('verb: to fall');
    expect(dict[0]).toMatchObject({ lemma: 'fallen', source: 'wiktionary' });
  });

  it('keeps the offset that identifies the saved occurrence', () => {
    const { words } = seedRows(seed, NOW, ids());
    expect(words[0].sentence.slice(words[0].charOffset)).toBe('fiel.');
  });
});
