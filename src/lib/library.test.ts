import { describe, expect, it } from 'vitest';
import { libraryRows, type LibraryDict, type LibraryText } from './library';

const text: LibraryText = {
  slug: 'sterntaler',
  title: 'Die Sterntaler',
  theme: 'Märchen',
  source: 'Die Sternthaler (1857)',
  pairs: [{ de: 'Es war einmal ein Mädchen.', en: 'There was once a girl.' }],
  lemmaMap: {
    Mädchen: [{ lemma: 'Mädchen', confidence: 1, method: 'exact' }],
    war: [{ lemma: 'sein', confidence: 0.9, method: 'table' }],
  },
};

const dict: LibraryDict[] = [
  { lemma: 'Mädchen', definitions: ['girl'] },
  { lemma: 'sein', definitions: ['to be'] },
  { lemma: 'Königstochter', definitions: ["king's daughter"] },
];

describe('libraryRows', () => {
  it('marks the document with its slug, so the list knows it is here', () => {
    const { doc } = libraryRows(text, dict, 1000, () => 'doc-1');
    expect(doc.librarySlug).toBe('sterntaler');
    expect(doc.title).toBe('Die Sterntaler');
    expect(doc.lastParagraphIndex).toBe(0);
  });

  it('writes only the definitions this text uses', () => {
    const { dict: entries } = libraryRows(text, dict, 1000, () => 'doc-1');
    // Königstochter belongs to another tale in the shared dictionary and has
    // no business in a reader's database because they opened this one.
    expect(entries.map((e) => e.lemma).sort()).toEqual(['Mädchen', 'sein']);
    expect(entries.every((e) => e.fetchedAt === 1000)).toBe(true);
  });

  it('survives a dictionary that has nothing for it', () => {
    const { doc, dict: entries } = libraryRows(text, [], 1000, () => 'doc-1');
    expect(entries).toEqual([]);
    expect(doc.pairs).toHaveLength(1);
  });
});
