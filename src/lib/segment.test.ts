import { describe, expect, it } from 'vitest';
import { locate, sentencesOf, tokenizeForDisplay } from './segment';

const words = (text: string) =>
  tokenizeForDisplay(text)
    .filter((t) => t.isWord)
    .map((t) => t.text);

describe('tokenizeForDisplay', () => {
  it('reproduces the paragraph exactly when joined', () => {
    const text = 'Der Frosch sprach: „Sei still, und weine nicht!“ — Er ging weg.';
    expect(tokenizeForDisplay(text).map((t) => t.text).join('')).toBe(text);
  });

  it('keeps hyphenated compounds whole', () => {
    expect(words('eine Sonnen-Blume')).toEqual(['eine', 'Sonnen-Blume']);
  });

  it('keeps apostrophes whole, both kinds', () => {
    expect(words("geht's und geht’s")).toEqual(["geht's", 'und', 'geht’s']);
  });

  it('separates German quotation marks and dashes from words', () => {
    expect(words('„Halt!“ — sagte er')).toEqual(['Halt', 'sagte', 'er']);
  });

  it('keeps eszett and umlauts inside words', () => {
    expect(words('Die Füße größer, daß')).toEqual(['Die', 'Füße', 'größer', 'daß']);
  });

  it('drops digits from words', () => {
    expect(words('im Jahr 1857 kam')).toEqual(['im', 'Jahr', 'kam']);
  });

  it('records the offset of each word', () => {
    const tokens = tokenizeForDisplay('Der Frosch');
    expect(tokens.filter((t) => t.isWord).map((t) => [t.text, t.start])).toEqual([
      ['Der', 0],
      ['Frosch', 4],
    ]);
  });
});

describe('sentencesOf', () => {
  it('splits on sentence punctuation', () => {
    expect(sentencesOf('Er kam. Sie ging! Warum?').map((s) => s.text)).toEqual([
      'Er kam.',
      'Sie ging!',
      'Warum?',
    ]);
  });

  it('does not split on a decimal or an abbreviation mid-word', () => {
    expect(sentencesOf('Er kam z.B. spät').map((s) => s.text)).toEqual([
      'Er kam z.B. spät',
    ]);
  });

  it('handles a closing quote after the full stop', () => {
    expect(sentencesOf('„Halt!“ Er ging.').map((s) => s.text)).toEqual([
      '„Halt!“',
      'Er ging.',
    ]);
  });
});

describe('locate', () => {
  const paragraph = 'Er kam nach Hause. Der Frosch sprach laut.';

  it('finds the sentence a word belongs to', () => {
    const at = paragraph.indexOf('Frosch');
    expect(locate(paragraph, at).sentence).toBe('Der Frosch sprach laut.');
  });

  it('reports the offset within that sentence, not the paragraph', () => {
    const at = paragraph.indexOf('Frosch');
    const { sentence, charOffset } = locate(paragraph, at);
    expect(sentence.slice(charOffset, charOffset + 6)).toBe('Frosch');
  });

  it('works for the first sentence too', () => {
    const at = paragraph.indexOf('Hause');
    const { sentence, charOffset } = locate(paragraph, at);
    expect(sentence.slice(charOffset, charOffset + 5)).toBe('Hause');
  });

  it('distinguishes repeated occurrences of the same word', () => {
    const text = 'Der Frosch sah den Frosch.';
    const first = text.indexOf('Frosch');
    const second = text.lastIndexOf('Frosch');
    expect(locate(text, first).charOffset).not.toBe(locate(text, second).charOffset);
  });
});
