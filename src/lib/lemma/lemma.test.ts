import { describe, expect, it } from 'vitest';
import { isResolved, lemmatize, offlineCandidates } from './cascade';
import { clauseContaining, tokenize, uniqueTokens } from './tokenize';
import { reverseUmlaut } from './suffix';
import { rank } from './types';

/** All candidate lemmas for a surface form, best first. */
const lemmas = (surface: string, sentence = '') =>
  offlineCandidates(surface, sentence).map((c) => c.lemma);

const top = (surface: string, sentence = '') => lemmas(surface, sentence)[0];

describe('tokenize', () => {
  it('keeps umlauts and eszett', () => {
    expect(tokenize('Die Füße größer')).toEqual(['Die', 'Füße', 'größer']);
  });

  it('drops punctuation and digits but keeps internal hyphens', () => {
    expect(tokenize('Das Haus, 12 Jahre alt — Sonnen-Blume!')).toEqual([
      'Das', 'Haus', 'Jahre', 'alt', 'Sonnen-Blume',
    ]);
  });

  it('preserves case, because German nouns are capitalised', () => {
    expect(tokenize('sie Sie')).toEqual(['sie', 'Sie']);
  });

  it('deduplicates across paragraphs, first-seen order', () => {
    expect(uniqueTokens(['der Mann', 'der Hund'])).toEqual(['der', 'Mann', 'Hund']);
  });

  it('finds the clause a word sits in', () => {
    expect(clauseContaining('Er kam nach Hause, und er ging weg', 'ging')).toBe(
      'und er ging weg',
    );
  });
});

describe('reverseUmlaut', () => {
  it('reverses äu before a single umlaut', () => {
    expect(reverseUmlaut('bäume')).toBe('baume');
  });
  it('reverses a single umlaut', () => {
    expect(reverseUmlaut('häus')).toBe('haus');
  });
  it('returns null when there is nothing to reverse', () => {
    expect(reverseUmlaut('haus')).toBeNull();
  });
});

describe('regular verbs', () => {
  it.each([
    ['machte', 'machen'],
    ['machten', 'machen'],
    ['sagtest', 'sagen'],
    ['spielt', 'spielen'],
    ['wohnst', 'wohnen'],
  ])('%s → %s', (surface, expected) => {
    expect(lemmas(surface)).toContain(expected);
  });
});

describe('strong and irregular verbs', () => {
  it.each([
    ['ging', 'gehen'],
    ['war', 'sein'],
    ['wurde', 'werden'],
    ['nimmt', 'nehmen'],
    ['weiß', 'wissen'],
    ['konnte', 'können'],
    ['sprach', 'sprechen'],
    ['hätte', 'haben'],
  ])('%s → %s as the top candidate', (surface, expected) => {
    expect(top(surface)).toBe(expected);
  });
});

describe('participles', () => {
  it.each([
    ['gelaufen', 'laufen'],
    ['gesprochen', 'sprechen'],
    ['gewesen', 'sein'],
    ['gegangen', 'gehen'],
  ])('strong: %s → %s', (surface, expected) => {
    expect(top(surface)).toBe(expected);
  });

  it.each([
    ['gemacht', 'machen'],
    ['gesagt', 'sagen'],
    ['gespielt', 'spielen'],
  ])('weak: %s → %s', (surface, expected) => {
    expect(lemmas(surface)).toContain(expected);
  });
});

describe('nouns in all four cases', () => {
  it.each([
    ['Hund', 'Hund'],       // nominative
    ['Hundes', 'Hund'],     // genitive
    ['Hunde', 'Hund'],      // dative (archaic) / plural
    ['Hunden', 'Hund'],     // dative plural
    ['Kindes', 'Kind'],
    ['Frauen', 'Frau'],
    ['Menschen', 'Mensch'],
  ])('%s → %s', (surface, expected) => {
    expect(lemmas(surface)).toContain(expected);
  });

  it('keeps the noun capitalised', () => {
    expect(lemmas('Häusern').every((l) => /^[A-ZÄÖÜ]/.test(l))).toBe(true);
  });
});

describe('umlaut plurals', () => {
  it.each([
    ['Häusern', 'Haus'],
    ['Bäume', 'Baum'],
    ['Väter', 'Vater'],
    ['Städte', 'Stadt'],
    ['Bücher', 'Buch'],
    ['Hände', 'Hand'],
    ['Wörter', 'Wort'],
  ])('%s → %s', (surface, expected) => {
    expect(lemmas(surface)).toContain(expected);
  });
});

describe('adjective endings', () => {
  it.each([
    ['großen', 'groß'],
    ['kleines', 'klein'],
    ['alten', 'alt'],
    ['gutem', 'gut'],
    ['schöner', 'schön'],
    ['dunkler', 'dunkel'],
  ])('%s → %s', (surface, expected) => {
    expect(lemmas(surface)).toContain(expected);
  });

  it('resolves suppletive comparatives from the table', () => {
    expect(top('besser')).toBe('gut');
    expect(top('höchsten')).toBe('hoch');
  });
});

describe('separable prefixes', () => {
  it('reconstructs a split prefix from the clause', () => {
    expect(lemmas('steht', 'Er steht jeden Morgen früh auf')).toContain('aufstehen');
  });

  it('still offers the simple verb alongside it', () => {
    expect(lemmas('steht', 'Er steht jeden Morgen früh auf')).toContain('stehen');
  });

  it('resolves a joined participle', () => {
    expect(lemmas('aufgestanden')).toContain('aufstehen');
  });

  it('resolves a joined infinitive form', () => {
    expect(lemmas('mitgenommen')).toContain('mitnehmen');
  });

  it('does not reach across a clause boundary for its prefix', () => {
    // The `auf` belongs to the second clause, not to `ging`.
    expect(lemmas('ging', 'Er ging nach Hause, und dann stand er auf')).not.toContain(
      'aufgehen',
    );
  });

  it('does not look backwards for a prefix', () => {
    expect(lemmas('kam', 'Auf dem Berg kam er an')).not.toContain('aufkommen');
  });
});

// The point of these is that the engine must not pretend. A ranked guess is
// fine; claiming confidence is not.
describe('words that should legitimately fail', () => {
  it.each([
    'Samsa',                 // proper noun
    'Schickele',             // proper noun
    'Familienernährer',      // compound
    'Oktoberheft',           // compound
    'Donaudampfschiff',      // compound
  ])('%s is not confidently resolved offline', (surface) => {
    expect(isResolved(offlineCandidates(surface))).toBe(false);
  });

  it('still offers the surface itself so a lookup is always possible', () => {
    expect(lemmas('Samsa')).toContain('Samsa');
  });
});

describe('rank', () => {
  it('keeps the best confidence per lemma and sorts descending', () => {
    expect(
      rank([
        { lemma: 'laufen', confidence: 0.4, method: 'suffix' },
        { lemma: 'laufen', confidence: 0.9, method: 'table' },
        { lemma: 'lauf', confidence: 0.5, method: 'suffix' },
      ]),
    ).toEqual([
      { lemma: 'laufen', confidence: 0.9, method: 'table' },
      { lemma: 'lauf', confidence: 0.5, method: 'suffix' },
    ]);
  });
});

describe('the Wiktionary stage', () => {
  it('outranks the offline guesses when it resolves', async () => {
    const result = await lemmatize('Häusern', {
      resolveForm: async () => ({ lemma: 'Haus', isLemma: false }),
    });
    expect(result[0]).toEqual({ lemma: 'Haus', confidence: 0.95, method: 'wiktionary' });
  });

  it('marks a citation form as exact', async () => {
    const result = await lemmatize('Haus', {
      resolveForm: async () => ({ lemma: null, isLemma: true }),
    });
    expect(result[0]).toEqual({ lemma: 'Haus', confidence: 1, method: 'exact' });
  });

  it('falls back to the offline stages when the network throws', async () => {
    const result = await lemmatize('Häusern', {
      resolveForm: async () => {
        throw new Error('offline');
      },
    });
    expect(result.map((c) => c.lemma)).toContain('Haus');
  });
});
