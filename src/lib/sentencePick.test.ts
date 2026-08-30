import { describe, expect, it } from 'vitest';
import type { Doc } from '@/db/types';
import {
  LENGTH_PENALTY,
  MIN_WORDS,
  bestAlternative,
  findOccurrences,
  scoreSentence,
} from './sentencePick';

/** Identity resolver: the test sentences use citation forms already. */
const asIs = (surface: string) => surface;

const familiar = (known: string[]) => (lemma: string) => known.includes(lemma);

describe('scoreSentence', () => {
  // Both cases, because German capitalises the first word of a sentence and
  // the lemma map resolves `Der` and `der` as the entries it actually holds.
  const KNOWN = ['der', 'Der', 'die', 'Die', 'das', 'Das', 'ist', 'und', 'in', 'ein',
    'eine', 'sehr', 'hier', 'war', 'den', 'dem'];

  it('scores a perfect i+1 sentence at zero', () => {
    // Everything but the target is already known, and the length is in range.
    const sentence = 'Der Frosch ist hier und das ist sehr';
    expect(scoreSentence(sentence, 'Frosch', { lemmaOf: asIs, isFamiliar: familiar(KNOWN) }))
      .toBe(0);
  });

  it('counts each unfamiliar lemma once', () => {
    const sentence = 'Der Frosch und die Kugel und der Brunnen sind hier';
    const score = scoreSentence(sentence, 'Frosch', {
      lemmaOf: asIs,
      isFamiliar: familiar(KNOWN),
    });
    // Kugel, Brunnen, sind — three unknowns besides the target.
    expect(score).toBe(3);
  });

  it('does not count a repeated unknown word twice', () => {
    const sentence = 'Der Frosch und der Brunnen und der Brunnen und das ist hier';
    expect(scoreSentence(sentence, 'Frosch', { lemmaOf: asIs, isFamiliar: familiar(KNOWN) }))
      .toBe(1);
  });

  it('never counts the target against itself', () => {
    const sentence = 'Der Frosch und der Frosch und das ist sehr hier';
    expect(scoreSentence(sentence, 'Frosch', { lemmaOf: asIs, isFamiliar: familiar(KNOWN) }))
      .toBe(0);
  });

  it('penalises a sentence too short to carry context', () => {
    const sentence = 'Der Frosch ist';
    const score = scoreSentence(sentence, 'Frosch', {
      lemmaOf: asIs,
      isFamiliar: familiar(KNOWN),
    });
    expect(score).toBeCloseTo((MIN_WORDS - 3) * LENGTH_PENALTY, 10);
  });

  it('penalises a sentence long enough to bury the target', () => {
    const words = ['Der', 'Frosch', ...Array.from({ length: 20 }, () => 'ist')];
    const score = scoreSentence(words.join(' '), 'Frosch', {
      lemmaOf: asIs,
      isFamiliar: familiar(KNOWN),
    });
    // 22 words, four over the ceiling, and nothing unknown but length.
    expect(score).toBeCloseTo(4 * LENGTH_PENALTY, 10);
  });

  it('resolves inflections through the lemma map', () => {
    const lemmaOf = (s: string) => (s === 'Frösche' ? 'Frosch' : s === 'waren' ? 'war' : s);
    const sentence = 'Die Frösche waren hier und das ist sehr';
    expect(scoreSentence(sentence, 'Frosch', { lemmaOf, isFamiliar: familiar(KNOWN) })).toBe(0);
  });

  it('prefers the lower-scoring of two candidates', () => {
    const easy = 'Der Frosch ist hier und das ist sehr';
    const hard = 'Der Frosch sprang aus dem Brunnen zur Königstochter hinüber';
    const options = { lemmaOf: asIs, isFamiliar: familiar(KNOWN) };
    expect(scoreSentence(easy, 'Frosch', options)).toBeLessThan(
      scoreSentence(hard, 'Frosch', options),
    );
  });
});

function doc(id: string, paragraphs: string[]): Doc {
  return {
    id,
    title: id,
    theme: '',
    pairs: paragraphs.map((de) => ({ de, en: `translation of ${de}` })),
    lemmaMap: {},
    lastParagraphIndex: 0,
    createdAt: 0,
  };
}

describe('findOccurrences', () => {
  const KNOWN = ['der', 'Der', 'die', 'Die', 'das', 'Das', 'ist', 'und', 'hier', 'sehr',
    'war', 'sein', 'den', 'dem'];
  const docs = [
    doc('d1', [
      'Der Frosch ist hier und das ist sehr. Die Kugel fiel in den tiefen Brunnen hinunter.',
      'Der Frosch sprang aus dem kalten Brunnen zur weinenden Königstochter.',
    ]),
    doc('d2', ['Das ist der Frosch und das war sehr hier.']),
  ];

  it('finds the lemma across every document', () => {
    const found = findOccurrences(docs, 'Frosch', familiar(KNOWN));
    expect(found).toHaveLength(3);
    expect(new Set(found.map((o) => o.docId))).toEqual(new Set(['d1', 'd2']));
  });

  it('ranks the cleanest sentence first', () => {
    const found = findOccurrences(docs, 'Frosch', familiar(KNOWN));
    expect(found[0].score).toBeLessThanOrEqual(found[1].score);
    expect(found[0].sentence).toContain('Der Frosch ist hier');
  });

  it('records where the target sits in the sentence it found', () => {
    const found = findOccurrences(docs, 'Frosch', familiar(KNOWN));
    for (const o of found) {
      expect(o.sentence.slice(o.charOffset, o.charOffset + 6)).toBe('Frosch');
    }
  });

  it('keeps the paragraph index, so the English side comes along', () => {
    const found = findOccurrences(docs, 'Frosch', familiar(KNOWN));
    const second = found.find((o) => o.sentence.includes('sprang'));
    expect(second?.paragraphIndex).toBe(1);
  });

  it('has nothing to say about a lemma the corpus does not contain', () => {
    expect(findOccurrences(docs, 'Regenschirm', familiar(KNOWN))).toEqual([]);
  });

  it('splits a paragraph into sentences rather than offering the whole thing', () => {
    const found = findOccurrences(docs, 'Kugel', familiar(KNOWN));
    expect(found).toHaveLength(1);
    expect(found[0].sentence).not.toContain('Frosch');
  });
});

describe('bestAlternative', () => {
  const occurrences = [
    { sentence: 'clean one', charOffset: 0, docId: 'd', paragraphIndex: 0, score: 0 },
    { sentence: 'current one', charOffset: 0, docId: 'd', paragraphIndex: 0, score: 2 },
    { sentence: 'worse one', charOffset: 0, docId: 'd', paragraphIndex: 0, score: 5 },
  ];

  it('offers a strictly better sentence', () => {
    const best = bestAlternative(occurrences, { sentence: 'current one', score: 2 });
    expect(best?.sentence).toBe('clean one');
  });

  it('offers nothing when the card already has the best sentence', () => {
    // A swap that does not improve the card wastes the tap.
    expect(bestAlternative(occurrences, { sentence: 'clean one', score: 0 })).toBeNull();
  });

  it('offers nothing when there is nowhere else the word appears', () => {
    expect(bestAlternative([], { sentence: 'only one', score: 3 })).toBeNull();
  });

  it('works out the current score when the card has none recorded', () => {
    const best = bestAlternative(occurrences, { sentence: 'worse one' });
    expect(best?.sentence).toBe('clean one');
  });
});
