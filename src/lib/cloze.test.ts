import { describe, expect, it } from 'vitest';
import { cloze } from './cloze';

describe('cloze', () => {
  it('blanks the word and keeps what surrounds it', () => {
    expect(cloze('Ein Blatt fiel vom Baum.', 'Blatt')).toEqual([
      { text: 'Ein ', hidden: false },
      { text: 'Blatt', hidden: true },
      { text: ' fiel vom Baum.', hidden: false },
    ]);
  });

  it('blanks every occurrence, or the others give the answer away', () => {
    expect(cloze('Der Mann sah den Mann.', 'Mann')).toEqual([
      { text: 'Der ', hidden: false },
      { text: 'Mann', hidden: true },
      { text: ' sah den ', hidden: false },
      { text: 'Mann', hidden: true },
      { text: '.', hidden: false },
    ]);
  });

  it('ignores case, so a sentence-initial occurrence is blanked too', () => {
    expect(cloze('Blatt um blatt.', 'blatt')).toEqual([
      { text: 'Blatt', hidden: true },
      { text: ' um ', hidden: false },
      { text: 'blatt', hidden: true },
      { text: '.', hidden: false },
    ]);
  });

  it('does not blank a match inside a longer word', () => {
    expect(cloze('Der andere Weg.', 'der')).toEqual([
      { text: 'Der', hidden: true },
      { text: ' andere Weg.', hidden: false },
    ]);
  });

  it('handles the word at either end', () => {
    expect(cloze('Blatt fiel.', 'Blatt')).toEqual([
      { text: 'Blatt', hidden: true },
      { text: ' fiel.', hidden: false },
    ]);
    expect(cloze('Das ist ein Blatt', 'Blatt')).toEqual([
      { text: 'Das ist ein ', hidden: false },
      { text: 'Blatt', hidden: true },
    ]);
  });

  it('leaves the sentence whole when the word is not in it', () => {
    expect(cloze('Ein Blatt fiel.', 'Baum')).toEqual([{ text: 'Ein Blatt fiel.', hidden: false }]);
    expect(cloze('Ein Blatt fiel.', '')).toEqual([{ text: 'Ein Blatt fiel.', hidden: false }]);
  });
});
