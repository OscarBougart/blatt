import { describe, expect, it } from 'vitest';
import type { ReviewLog, SavedWord, Sighting } from '@/db/types';
import {
  FAMILIAR_SIGHTINGS,
  LAPSE_WINDOW_MS,
  buildFamiliarity,
  familiarFromReview,
  familiarFromSightings,
  lastLapseAt,
} from './familiarity';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function word(overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    id: 'w1',
    surface: 'Frosch',
    lemma: 'Frosch',
    definition: 'frog',
    sentence: 'Der Frosch sprang.',
    charOffset: 4,
    docId: 'd1',
    paragraphIndex: 0,
    createdAt: NOW,
    ease: 2.5,
    interval: 6,
    repetitions: 2,
    dueAt: NOW,
    lapses: 0,
    ...overrides,
  };
}

function log(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: 'r1',
    wordId: 'w1',
    reviewedAt: NOW,
    grade: 3,
    intervalBefore: 1,
    easeBefore: 2.5,
    elapsedDays: 1,
    durationMs: 4000,
    ...overrides,
  };
}

const sighting = (count: number, lemma = 'Baum'): Sighting => ({
  lemma,
  count,
  lastSeenAt: NOW,
});

describe('lastLapseAt', () => {
  it('is null when nothing was ever failed', () => {
    expect(lastLapseAt([log({ grade: 3 }), log({ grade: 4 })])).toBeNull();
  });

  it('finds the most recent failure', () => {
    const logs = [
      log({ id: 'a', grade: 1, reviewedAt: NOW - 10 * DAY }),
      log({ id: 'b', grade: 1, reviewedAt: NOW - 2 * DAY }),
      log({ id: 'c', grade: 4, reviewedAt: NOW }),
    ];
    expect(lastLapseAt(logs)).toBe(NOW - 2 * DAY);
  });

  it('counts only Again as a failure', () => {
    expect(lastLapseAt([log({ grade: 2 })])).toBeNull();
  });
});

describe('familiarFromReview', () => {
  it('needs two repetitions', () => {
    expect(familiarFromReview(word({ repetitions: 1 }), null, NOW)).toBe(false);
    expect(familiarFromReview(word({ repetitions: 2 }), null, NOW)).toBe(true);
  });

  it('is false for a word never saved', () => {
    expect(familiarFromReview(undefined, null, NOW)).toBe(false);
  });

  it('is disqualified by a lapse inside the window', () => {
    expect(familiarFromReview(word({ repetitions: 9 }), NOW - DAY, NOW)).toBe(false);
  });

  it('forgives a lapse older than the window', () => {
    const old = NOW - LAPSE_WINDOW_MS - DAY;
    expect(familiarFromReview(word({ repetitions: 2 }), old, NOW)).toBe(true);
  });
});

describe('familiarFromSightings', () => {
  it('needs three paragraphs read past', () => {
    expect(familiarFromSightings(sighting(FAMILIAR_SIGHTINGS - 1), false)).toBe(false);
    expect(familiarFromSightings(sighting(FAMILIAR_SIGHTINGS), false)).toBe(true);
  });

  it('does not apply to a word the reader saved', () => {
    // Saving it is evidence of the opposite, however often it has been seen.
    expect(familiarFromSightings(sighting(50), true)).toBe(false);
  });

  it('handles a lemma with no sightings at all', () => {
    expect(familiarFromSightings(undefined, false)).toBe(false);
  });
});

describe('buildFamiliarity', () => {
  it('answers from either kind of evidence', () => {
    const isFamiliar = buildFamiliarity(
      {
        words: [word({ id: 'w1', lemma: 'Frosch', repetitions: 3 })],
        sightings: [sighting(4, 'Baum')],
        logs: [],
      },
      NOW,
    );

    expect(isFamiliar('Frosch')).toBe(true);
    expect(isFamiliar('Baum')).toBe(true);
    expect(isFamiliar('Königstochter')).toBe(false);
  });

  it('uses the review log to disqualify a recently lapsed word', () => {
    const isFamiliar = buildFamiliarity(
      {
        words: [word({ id: 'w1', lemma: 'Frosch', repetitions: 5 })],
        sightings: [],
        logs: [log({ wordId: 'w1', grade: 1, reviewedAt: NOW - DAY })],
      },
      NOW,
    );
    expect(isFamiliar('Frosch')).toBe(false);
  });

  it('does not let one word lapse disqualify another', () => {
    const isFamiliar = buildFamiliarity(
      {
        words: [
          word({ id: 'w1', lemma: 'Frosch', repetitions: 5 }),
          word({ id: 'w2', lemma: 'Brunnen', repetitions: 5 }),
        ],
        sightings: [],
        logs: [log({ wordId: 'w1', grade: 1, reviewedAt: NOW - DAY })],
      },
      NOW,
    );
    expect(isFamiliar('Frosch')).toBe(false);
    expect(isFamiliar('Brunnen')).toBe(true);
  });

  it('counts a lemma familiar if any one of its saved words qualifies', () => {
    // The same word met in two texts. Knowing it once is knowing it.
    const isFamiliar = buildFamiliarity(
      {
        words: [
          word({ id: 'w1', lemma: 'Frosch', repetitions: 0 }),
          word({ id: 'w2', lemma: 'Frosch', repetitions: 4 }),
        ],
        sightings: [],
        logs: [],
      },
      NOW,
    );
    expect(isFamiliar('Frosch')).toBe(true);
  });

  it('ignores sightings of a word that was saved', () => {
    const isFamiliar = buildFamiliarity(
      {
        words: [word({ id: 'w1', lemma: 'Frosch', repetitions: 0 })],
        sightings: [sighting(10, 'Frosch')],
        logs: [],
      },
      NOW,
    );
    expect(isFamiliar('Frosch')).toBe(false);
  });
});
