import { describe, expect, it } from 'vitest';
import { sentences, splitParagraph, splitParagraphs } from './split-paragraphs';

const short = 'Es war einmal ein kleines Mädchen. Ihm war Vater und Mutter gestorben.';
const long = Array.from(
  { length: 12 },
  (_, i) => `Das ist der ${i + 1}. Satz und er ist lang genug um mitzuzählen, denn er hat viele Wörter darin.`,
).join(' ');

describe('sentences', () => {
  it('keeps the closing quote with its sentence', () => {
    const parts = sentences('Er rief: „Komm her!“ Dann ging er fort.');
    expect(parts).toEqual(['Er rief: „Komm her!“', 'Dann ging er fort.']);
  });
});

describe('splitParagraph', () => {
  it('leaves a flip-sized paragraph alone', () => {
    expect(splitParagraph(short)).toEqual([short]);
  });

  it('cuts a long one, losing nothing', () => {
    const chunks = splitParagraph(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(long);
  });

  it('never leaves a stranded tail', () => {
    for (const chunk of splitParagraph(long)) {
      expect(chunk.split(/\s+/).length).toBeGreaterThanOrEqual(20);
    }
  });

  it('leaves an uncuttable paragraph whole rather than chopping a clause', () => {
    const noBreaks = 'wort '.repeat(200).trim();
    expect(splitParagraph(noBreaks)).toEqual([noBreaks]);
  });
});

describe('splitParagraphs', () => {
  it('preserves order and content across a text', () => {
    const out = splitParagraphs([short, long]);
    expect(out[0]).toBe(short);
    expect(out.join(' ')).toBe(`${short} ${long}`);
  });
});
