import { describe, expect, it } from 'vitest';
import { lemmasOf } from './sightings';

const map = {
  Frösche: [{ lemma: 'Frosch', confidence: 0.9, method: 'wiktionary' as const }],
  sprangen: [{ lemma: 'springen', confidence: 0.9, method: 'wiktionary' as const }],
};

describe('lemmasOf', () => {
  it('resolves surface forms through the document map', () => {
    expect(lemmasOf('Frösche sprangen.', map).sort()).toEqual(['Frosch', 'springen']);
  });

  it('falls back to the surface form when the map has nothing', () => {
    expect(lemmasOf('Nebel', map)).toEqual(['Nebel']);
  });

  it('counts a repeated word once', () => {
    // One paragraph is one act of reading, however often it says the word.
    expect(lemmasOf('Frösche und Frösche und Frösche.', map)).toEqual(['Frosch', 'und']);
  });

  it('ignores punctuation and numbers', () => {
    expect(lemmasOf('— 1857, ja!', {})).toEqual(['ja']);
  });

  it('has nothing to say about an empty paragraph', () => {
    expect(lemmasOf('', {})).toEqual([]);
  });
});
