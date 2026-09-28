import { describe, expect, it } from 'vitest';
import type { Session } from '@/db/types';
import {
  countingSince,
  flipsByText,
  formatSeconds,
  medianDuration,
  reviewsPerDay,
  totalFlips,
} from './stats';

const START = 1_700_000_000_000;

function session(overrides: Partial<Session> = {}): Session {
  const viewed = overrides.paragraphsViewed ?? 10;
  const flipped = overrides.paragraphsFlipped ?? 4;
  return {
    id: 's1',
    docId: 'd1',
    startedAt: START,
    endedAt: START + 6 * 60_000,
    paragraphsViewed: viewed,
    paragraphsFlipped: flipped,
    flipRate: viewed === 0 ? 0 : flipped / viewed,
    ...overrides,
  };
}

describe('flips', () => {
  const counted = [
    session({ id: 'a', docId: 'd1', flips: 4, startedAt: START + 1000 }),
    session({ id: 'b', docId: 'd2', flips: 9, startedAt: START + 2000 }),
    session({ id: 'c', docId: 'd1', flips: 3, startedAt: START + 3000 }),
  ];
  // From before flips were counted: no count at all, which is not zero.
  const uncounted = session({ id: 'old', docId: 'd3', startedAt: START });

  it('totals only sessions that were counted', () => {
    expect(totalFlips([...counted, uncounted])).toBe(16);
  });

  it('dates counting from the first counted session', () => {
    expect(countingSince([...counted, uncounted])).toBe(START + 1000);
    expect(countingSince([uncounted])).toBeNull();
  });

  it('sums flips per text, most first', () => {
    expect(flipsByText([...counted, uncounted])).toEqual([
      { docId: 'd2', flips: 9 },
      { docId: 'd1', flips: 7 },
    ]);
  });

  it('keeps a text read without a single flip', () => {
    const clean = session({ id: 'z', docId: 'd4', flips: 0 });
    expect(flipsByText([clean])).toEqual([{ docId: 'd4', flips: 0 }]);
  });
});

describe('reviewsPerDay', () => {
  const day = 24 * 60 * 60 * 1000;

  it('returns one entry per day, including the empty ones', () => {
    const strip = reviewsPerDay([], START, 7);
    expect(strip).toHaveLength(7);
    expect(strip.every((d) => d.count === 0)).toBe(true);
  });

  it('ends on today', () => {
    const strip = reviewsPerDay([{ reviewedAt: START }], START, 7);
    expect(strip[strip.length - 1].count).toBe(1);
  });

  it('buckets several reviews into the day they happened', () => {
    const logs = [
      { reviewedAt: START },
      { reviewedAt: START - 60_000 },
      { reviewedAt: START - 3 * day },
    ];
    const strip = reviewsPerDay(logs, START, 7);
    expect(strip[strip.length - 1].count).toBe(2);
    expect(strip[strip.length - 4].count).toBe(1);
  });

  it('drops reviews older than the window', () => {
    const strip = reviewsPerDay([{ reviewedAt: START - 90 * day }], START, 30);
    expect(strip.reduce((sum, d) => sum + d.count, 0)).toBe(0);
  });

  it('runs oldest first', () => {
    const strip = reviewsPerDay([], START, 5);
    expect(strip[0].day).toBeLessThan(strip[4].day);
  });
});

describe('medianDuration', () => {
  it('is null with nothing to report', () => {
    expect(medianDuration([])).toBeNull();
  });

  it('takes the middle of an odd count', () => {
    expect(medianDuration([{ durationMs: 1000 }, { durationMs: 9000 }, { durationMs: 3000 }]))
      .toBe(3000);
  });

  it('averages the middle two of an even count', () => {
    expect(medianDuration([{ durationMs: 1000 }, { durationMs: 3000 }])).toBe(2000);
  });

  it('is not dragged about by a card left on screen', () => {
    // The reason this is a median: one abandoned card would own the mean.
    const logs = [
      { durationMs: 2000 },
      { durationMs: 3000 },
      { durationMs: 4000 },
      { durationMs: 20 * 60 * 1000 },
    ];
    expect(medianDuration(logs)).toBe(3500);
  });

  it('ignores impossible durations', () => {
    expect(medianDuration([{ durationMs: 0 }, { durationMs: -5 }, { durationMs: 2000 }]))
      .toBe(2000);
  });
});

describe('formatSeconds', () => {
  it('reads in seconds, to one decimal', () => {
    expect(formatSeconds(4200)).toBe('4.2s');
    expect(formatSeconds(900)).toBe('0.9s');
  });
});
