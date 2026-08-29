import { describe, expect, it } from 'vitest';
import { cloze } from './cloze';

describe('cloze', () => {
  it('splits around the saved occurrence', () => {
    expect(cloze('Ein Blatt fiel vom Baum.', 'Blatt', 4)).toEqual({
      before: 'Ein ',
      hidden: 'Blatt',
      after: ' fiel vom Baum.',
    });
  });

  it('blanks the tapped occurrence, not the first', () => {
    const sentence = 'Der Mann sah den Mann.';
    expect(cloze(sentence, 'Mann', 17)).toEqual({
      before: 'Der Mann sah den ',
      hidden: 'Mann',
      after: '.',
    });
  });

  it('handles a word at the start', () => {
    expect(cloze('Blatt fiel.', 'Blatt', 0)).toEqual({
      before: '',
      hidden: 'Blatt',
      after: ' fiel.',
    });
  });

  it('handles a word at the end', () => {
    expect(cloze('Das ist ein Blatt', 'Blatt', 12)).toEqual({
      before: 'Das ist ein ',
      hidden: 'Blatt',
      after: '',
    });
  });

  it('falls back to the first occurrence when the offset is stale', () => {
    expect(cloze('Ein Blatt fiel.', 'Blatt', 99)).toEqual({
      before: 'Ein ',
      hidden: 'Blatt',
      after: ' fiel.',
    });
  });

  it('falls back when the offset points at the wrong text', () => {
    expect(cloze('Ein Blatt fiel.', 'Blatt', 0)).toEqual({
      before: 'Ein ',
      hidden: 'Blatt',
      after: ' fiel.',
    });
  });

  it('leaves the sentence whole when the word is not in it', () => {
    expect(cloze('Ein Blatt fiel.', 'Baum', 0)).toEqual({
      before: 'Ein Blatt fiel.',
      hidden: '',
      after: '',
    });
  });

  it('leaves the sentence whole when there is no surface form', () => {
    expect(cloze('Ein Blatt fiel.', '', 0)).toEqual({
      before: 'Ein Blatt fiel.',
      hidden: '',
      after: '',
    });
  });
});
