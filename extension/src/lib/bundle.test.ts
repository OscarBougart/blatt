import { describe, expect, it } from 'vitest';
import { FORMAT, VERSION, buildBundle, bundleFilename, wordKey } from './bundle';
import { cleanBlocks, fallbackTitle, tidy } from './blocks';

const NOW = Date.UTC(2026, 7, 30);

function ids() {
  let n = 0;
  return () => `id${n++}`;
}

const input = {
  title: 'Der Frosch am Brunnen',
  theme: 'Zeitung',
  pairs: [{ de: 'Ein Frosch sprang.', en: 'A frog jumped.' }],
  lemmaMap: { sprang: [{ lemma: 'springen', confidence: 0.9, method: 'wiktionary' as const }] },
  definitions: [
    { lemma: 'springen', definitions: ['verb: to jump'] },
    { lemma: 'Nichts', definitions: [] },
  ],
  words: [
    {
      surface: 'sprang',
      lemma: 'springen',
      definition: 'verb: to jump',
      sentence: 'Ein Frosch sprang.',
      charOffset: 11,
      url: 'https://www.zeit.de/x',
      title: 'Der Frosch am Brunnen',
      createdAt: NOW,
    },
  ],
  now: NOW,
  id: ids(),
};

describe('buildBundle', () => {
  it('writes the format the app already imports', () => {
    const bundle = buildBundle({ ...input, id: ids() });
    expect(bundle.format).toBe(FORMAT);
    expect(bundle.version).toBe(VERSION);
    // Every table the importer reads must be present, even if empty.
    expect(bundle).toHaveProperty('sessions');
    expect(bundle).toHaveProperty('forms');
    expect(bundle).toHaveProperty('reviews');
    expect(bundle).toHaveProperty('sightings');
  });

  it('carries one document with its pairs and lemma map', () => {
    const { docs } = buildBundle({ ...input, id: ids() });
    expect(docs).toHaveLength(1);
    expect(docs[0].pairs).toEqual(input.pairs);
    expect(docs[0].lemmaMap.sprang[0].lemma).toBe('springen');
    expect(docs[0].lastParagraphIndex).toBe(0);
  });

  it('points saved words at the document it just made', () => {
    const { docs, words } = buildBundle({ ...input, id: ids() });
    expect(words[0].docId).toBe(docs[0].id);
    expect(words[0].id).not.toBe(docs[0].id);
  });

  it('leaves captured words in the queue rather than making them cards', () => {
    // A capture must not be able to flood next week's reviews.
    const { words } = buildBundle({ ...input, id: ids() });
    expect(words[0].introducedAt).toBeUndefined();
    expect(words[0].cardMode).toBe('recognition');
    expect(words[0].ease).toBe(2.5);
  });

  it('drops definitions Wiktionary had nothing for', () => {
    const { dict } = buildBundle({ ...input, id: ids() });
    expect(dict.map((d) => d.lemma)).toEqual(['springen']);
  });

  it('keeps the offset that identifies the saved occurrence', () => {
    const { words } = buildBundle({ ...input, id: ids() });
    const { sentence, charOffset, surface } = words[0];
    expect(sentence.slice(charOffset, charOffset + surface.length)).toBe(surface);
  });
});

describe('bundleFilename', () => {
  it('never collides with a backup, which is blatt-<date>.json', () => {
    expect(bundleFilename('Der Frosch am Brunnen', NOW)).toMatch(/^blatt-capture-/);
  });

  it('is a readable, sortable name', () => {
    expect(bundleFilename('Der Frosch am Brunnen', NOW)).toBe(
      'blatt-capture-der-frosch-am-brunnen-2026-08-30.json',
    );
  });

  it('folds umlauts rather than dropping them', () => {
    expect(bundleFilename('Königstöchter', NOW)).toBe('blatt-capture-koenigstoechter-2026-08-30.json');
  });

  it('survives a title with nothing usable in it', () => {
    expect(bundleFilename('!!!', NOW)).toBe('blatt-capture-article-2026-08-30.json');
  });
});

describe('cleanBlocks', () => {
  const prose = 'Der Frosch sprang aus dem Brunnen und sah die Königstochter an.';
  const more = 'Sie weinte sehr, denn die goldene Kugel war ihr entfallen und fort.';

  it('keeps the article and drops the furniture', () => {
    expect(cleanBlocks(['Anzeige', prose, 'Foto: dpa', more])).toEqual([prose, more]);
  });

  it('drops blocks too short to be a paragraph', () => {
    expect(cleanBlocks(['Kurz.', prose])).toEqual([prose]);
  });

  it('drops a block repeated by navigation or a teaser', () => {
    expect(cleanBlocks([prose, more, prose])).toEqual([prose, more]);
  });

  it('preserves order, because the index is the pairing', () => {
    expect(cleanBlocks([prose, more])).toEqual([prose, more]);
  });

  it('tidies whitespace and soft hyphens', () => {
    expect(tidy('  Königs­tochter \n  sprang  ')).toBe('Königstochter sprang');
  });
});

describe('fallbackTitle', () => {
  it('reads a slug when there is no title', () => {
    expect(fallbackTitle('https://www.zeit.de/politik/der-lange-weg')).toBe('der lange weg');
  });

  it('falls back to the host', () => {
    expect(fallbackTitle('https://www.spiegel.de/')).toBe('spiegel.de');
  });

  it('survives nonsense', () => {
    expect(fallbackTitle('not a url')).toBe('Captured article');
  });
});

describe('wordKey', () => {
  const base = { url: 'https://x.de/a', sentence: 'Der Hund bellt.', charOffset: 4, surface: 'Hund' };

  it('is the same for the same word in the same place', () => {
    expect(wordKey(base)).toBe(wordKey({ ...base }));
  });

  it('separates the same word twice in one sentence', () => {
    expect(wordKey(base)).not.toBe(wordKey({ ...base, charOffset: 20 }));
  });

  it('separates the same sentence on two pages', () => {
    expect(wordKey(base)).not.toBe(wordKey({ ...base, url: 'https://y.de/a' }));
  });

  it('does not collide across field boundaries', () => {
    expect(wordKey({ url: 'a', sentence: 'b', charOffset: 1, surface: 'c' })).not.toBe(
      wordKey({ url: 'a', sentence: 'b|1', charOffset: 0, surface: 'c' }),
    );
  });
});
