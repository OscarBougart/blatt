import { describe, expect, it } from 'vitest';
import { pairParagraphs, splitParagraphs } from './pair';

describe('splitParagraphs', () => {
  it('splits on blank lines and trims', () => {
    expect(splitParagraphs('eins\n\nzwei\n\ndrei')).toEqual(['eins', 'zwei', 'drei']);
  });

  it('tolerates CRLF and whitespace-only separator lines', () => {
    expect(splitParagraphs('eins\r\n   \r\nzwei')).toEqual(['eins', 'zwei']);
  });

  it('collapses runs of blank lines rather than emitting empties', () => {
    expect(splitParagraphs('eins\n\n\n\nzwei')).toEqual(['eins', 'zwei']);
  });

  it('drops leading and trailing blank lines', () => {
    expect(splitParagraphs('\n\neins\n\n')).toEqual(['eins']);
  });

  it('keeps single newlines inside a paragraph', () => {
    expect(splitParagraphs('eine Zeile\nnoch eine\n\nzwei')).toEqual([
      'eine Zeile\nnoch eine',
      'zwei',
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([]);
  });
});

describe('pairParagraphs', () => {
  it('zips equal counts index by index', () => {
    const r = pairParagraphs('A\n\nB', 'one\n\ntwo');
    expect(r.pairs).toEqual([
      { de: 'A', en: 'one' },
      { de: 'B', en: 'two' },
    ]);
    expect(r.mismatch).toBe(false);
  });

  it('pads English when German is longer, never truncating German', () => {
    const r = pairParagraphs('A\n\nB\n\nC', 'one');
    expect(r.pairs).toEqual([
      { de: 'A', en: 'one' },
      { de: 'B', en: '' },
      { de: 'C', en: '' },
    ]);
    expect(r).toMatchObject({ deCount: 3, enCount: 1, mismatch: true });
  });

  it('pads German when English is longer, never truncating English', () => {
    const r = pairParagraphs('A', 'one\n\ntwo');
    expect(r.pairs).toEqual([
      { de: 'A', en: 'one' },
      { de: '', en: 'two' },
    ]);
    expect(r).toMatchObject({ deCount: 1, enCount: 2, mismatch: true });
  });

  it('reports counts of zero for empty input', () => {
    const r = pairParagraphs('', '');
    expect(r.pairs).toEqual([]);
    expect(r).toMatchObject({ deCount: 0, enCount: 0, mismatch: false });
  });
});
