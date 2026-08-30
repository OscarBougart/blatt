import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import {
  DAY,
  GRADE_NUMBER,
  LEECH_LAPSES,
  MIN_EASE,
  dueWords,
  formatDays,
  isLeech,
  nextEase,
  nextInterval,
  schedule,
  shuffle,
} from './srs';

const NOW = 1_700_000_000_000;

function card(overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    id: 'w1',
    surface: 'Blatt',
    lemma: 'Blatt',
    definition: 'leaf, sheet',
    sentence: 'Ein Blatt fiel vom Baum.',
    charOffset: 4,
    docId: 'd1',
    paragraphIndex: 0,
    createdAt: NOW,
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    dueAt: NOW,
    lapses: 0,
    ...overrides,
  };
}

describe('nextEase', () => {
  // EF' = EF + (0.1 - (5-q)(0.08 + (5-q)0.02))
  it('leaves ease untouched at q=4', () => {
    expect(nextEase(2.5, 4)).toBeCloseTo(2.5, 10);
  });

  it('raises ease at q=5', () => {
    expect(nextEase(2.5, 5)).toBeCloseTo(2.6, 10);
  });

  it('lowers ease by 0.14 at q=3', () => {
    expect(nextEase(2.5, 3)).toBeCloseTo(2.36, 10);
  });

  it('lowers ease by 0.8 at q=0', () => {
    expect(nextEase(2.5, 0)).toBeCloseTo(1.7, 10);
  });

  it('lowers ease by 0.54 at q=1, the grade Hard actually uses', () => {
    expect(nextEase(2.5, 1)).toBeCloseTo(1.96, 10);
  });

  it('floors ease at 1.3', () => {
    expect(nextEase(1.3, 0)).toBe(MIN_EASE);
    expect(nextEase(1.5, 0)).toBe(MIN_EASE);
  });
});

describe('nextInterval', () => {
  it('follows the 1 / 6 / previous x ease ladder', () => {
    expect(nextInterval(1, 0, 2.5)).toBe(1);
    expect(nextInterval(2, 1, 2.5)).toBe(6);
    expect(nextInterval(3, 6, 2.5)).toBe(15);
    expect(nextInterval(4, 15, 2.5)).toBe(38);
  });

  it('never returns less than a day', () => {
    expect(nextInterval(3, 1, 1.3)).toBe(1);
  });
});

describe('schedule', () => {
  it('walks the textbook sequence for repeated Good answers', () => {
    // Ease is unchanged at q=4, so this is the pure 1 / 6 / xEF ladder.
    let word = card();

    word = schedule(word, 'good', NOW);
    expect(word.repetitions).toBe(1);
    expect(word.interval).toBe(1);
    expect(word.ease).toBeCloseTo(2.5, 10);
    expect(word.dueAt).toBe(NOW + DAY);

    word = schedule(word, 'good', NOW);
    expect(word.repetitions).toBe(2);
    expect(word.interval).toBe(6);
    expect(word.dueAt).toBe(NOW + 6 * DAY);

    word = schedule(word, 'good', NOW);
    expect(word.repetitions).toBe(3);
    expect(word.interval).toBe(15); // round(6 x 2.5)

    word = schedule(word, 'good', NOW);
    expect(word.repetitions).toBe(4);
    expect(word.interval).toBe(38); // round(15 x 2.5)
  });

  it('drops ease but keeps the ladder on Medium', () => {
    const word = schedule(card({ repetitions: 2, interval: 6 }), 'medium', NOW);
    expect(word.ease).toBeCloseTo(2.36, 10);
    expect(word.repetitions).toBe(3);
    expect(word.interval).toBe(14); // round(6 x 2.36)
    expect(word.lapses).toBe(0);
  });

  it('raises ease on Easy', () => {
    const word = schedule(card({ repetitions: 2, interval: 6 }), 'easy', NOW);
    expect(word.ease).toBeCloseTo(2.6, 10);
    expect(word.interval).toBe(16); // round(6 x 2.6)
  });

  it('resets repetitions and counts a lapse on Again', () => {
    const mature = card({ repetitions: 4, interval: 38, ease: 2.5, lapses: 1 });
    const word = schedule(mature, 'hard', NOW);

    expect(word.repetitions).toBe(0);
    expect(word.interval).toBe(1);
    expect(word.lapses).toBe(2);
    expect(word.ease).toBeCloseTo(1.96, 10);
    expect(word.dueAt).toBe(NOW + DAY);
  });

  it('climbs more slowly after a lapse, because the ease was kept', () => {
    let word = schedule(card({ repetitions: 4, interval: 38 }), 'hard', NOW);
    word = schedule(word, 'good', NOW);
    expect(word.interval).toBe(1);
    word = schedule(word, 'good', NOW);
    expect(word.interval).toBe(6);
    word = schedule(word, 'good', NOW);
    expect(word.interval).toBe(12); // round(6 x 1.96), not 15
  });

  it('is pure', () => {
    const word = card();
    const before = { ...word };
    schedule(word, 'hard', NOW);
    expect(word).toEqual(before);
  });

  it('preserves the fields it does not own', () => {
    const word = schedule(card({ note: 'my own gloss' }), 'good', NOW);
    expect(word.surface).toBe('Blatt');
    expect(word.sentence).toBe('Ein Blatt fiel vom Baum.');
    expect(word.note).toBe('my own gloss');
  });
});

describe('dueWords', () => {
  it('takes everything at or before now', () => {
    const words = [{ dueAt: NOW - DAY }, { dueAt: NOW }, { dueAt: NOW + 1 }];
    expect(dueWords(words, NOW)).toHaveLength(2);
  });
});

describe('shuffle', () => {
  it('keeps every item', () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items, () => 0.5).slice().sort()).toEqual(items);
  });

  it('does not mutate the input', () => {
    const items = [1, 2, 3];
    shuffle(items, () => 0);
    expect(items).toEqual([1, 2, 3]);
  });
});

describe('formatDays', () => {
  it('stays compact enough for a button', () => {
    expect(formatDays(1)).toBe('1d');
    expect(formatDays(6)).toBe('6d');
    expect(formatDays(15)).toBe('2w');
    expect(formatDays(38)).toBe('1mo');
    expect(formatDays(400)).toBe('1.1y');
  });
});

describe('leeches', () => {
  it('recognises a word failed six times', () => {
    expect(isLeech({ lapses: LEECH_LAPSES - 1 })).toBe(false);
    expect(isLeech({ lapses: LEECH_LAPSES })).toBe(true);
  });

  it('suspends a card as it crosses the threshold', () => {
    const next = schedule(card({ lapses: LEECH_LAPSES - 1, repetitions: 2 }), 'hard', NOW);
    expect(next.lapses).toBe(LEECH_LAPSES);
    expect(next.suspended).toBe(true);
    expect(next.leechFlaggedAt).toBe(NOW);
  });

  it('leaves a card below the threshold alone', () => {
    const next = schedule(card({ lapses: 2 }), 'hard', NOW);
    expect(next.suspended).toBeUndefined();
    expect(next.leechFlaggedAt).toBeUndefined();
  });

  it('does not re-flag a word already flagged', () => {
    // Un-suspending it by hand must not be undone by the next failure.
    const flagged = card({ lapses: 8, leechFlaggedAt: NOW - 1000, suspended: false });
    const next = schedule(flagged, 'hard', NOW);
    expect(next.leechFlaggedAt).toBe(NOW - 1000);
    expect(next.suspended).toBe(false);
  });

  it('never suspends on a pass', () => {
    const next = schedule(card({ lapses: LEECH_LAPSES + 2 }), 'good', NOW);
    expect(next.suspended).toBeUndefined();
  });
});

describe('GRADE_NUMBER', () => {
  it('maps the four buttons onto the numeric scale, hardest first', () => {
    expect(GRADE_NUMBER).toEqual({ hard: 1, medium: 2, good: 3, easy: 4 });
  });
});
