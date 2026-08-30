import { describe, expect, it } from 'vitest';
import type { Session } from '@/db/types';
import {
  combinedRate,
  duration,
  formatDuration,
  formatRate,
  interpret,
  formatSeconds,
  medianDuration,
  plotPoints,
  readableSessions,
  reviewsPerDay,
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

describe('duration', () => {
  it('measures a closed session', () => {
    expect(duration(session())).toBe(6 * 60_000);
  });

  it('is zero for a session still open', () => {
    expect(duration(session({ endedAt: undefined }))).toBe(0);
  });
});

describe('formatDuration', () => {
  it('rounds to minutes and hours', () => {
    expect(formatDuration(20_000)).toBe('under a minute');
    expect(formatDuration(6 * 60_000)).toBe('6 min');
    expect(formatDuration(72 * 60_000)).toBe('1 h 12 min');
  });
});

describe('formatRate', () => {
  it('is a whole percentage', () => {
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(0.384)).toBe('38%');
    expect(formatRate(1)).toBe('100%');
  });
});

describe('readableSessions', () => {
  it('drops sessions too short to mean anything', () => {
    const kept = readableSessions([
      session({ id: 'a', paragraphsViewed: 2 }),
      session({ id: 'b', paragraphsViewed: 3 }),
    ]);
    expect(kept.map((s) => s.id)).toEqual(['b']);
  });

  it('drops sessions that never finished', () => {
    const kept = readableSessions([
      session({ id: 'open', endedAt: undefined }),
      session({ id: 'closed' }),
    ]);
    expect(kept.map((s) => s.id)).toEqual(['closed']);
  });

  it('orders oldest first', () => {
    const kept = readableSessions([
      session({ id: 'new', startedAt: START + 1000 }),
      session({ id: 'old', startedAt: START }),
    ]);
    expect(kept.map((s) => s.id)).toEqual(['old', 'new']);
  });
});

describe('combinedRate', () => {
  it('weights by paragraphs read, not by session', () => {
    const rate = combinedRate([
      session({ paragraphsViewed: 100, paragraphsFlipped: 10 }),
      session({ paragraphsViewed: 4, paragraphsFlipped: 4 }),
    ]);
    // 14 / 104, not the 55% a naive average of the two rates would give.
    expect(rate).toBeCloseTo(14 / 104, 10);
  });

  it('is zero with nothing read', () => {
    expect(combinedRate([])).toBe(0);
  });
});

describe('plotPoints', () => {
  it('pins the axis to 0-1 rather than scaling to the data', () => {
    const points = plotPoints(
      [
        session({ paragraphsViewed: 10, paragraphsFlipped: 0 }),
        session({ paragraphsViewed: 10, paragraphsFlipped: 10 }),
      ],
      100,
      50,
    );
    expect(points).toEqual([
      { x: 0, y: 50 },
      { x: 100, y: 0 },
    ]);
  });

  it('centres a single session', () => {
    const points = plotPoints([session({ paragraphsViewed: 10, paragraphsFlipped: 5 })], 100, 50);
    expect(points).toEqual([{ x: 50, y: 25 }]);
  });

  it('has nothing to draw with no sessions', () => {
    expect(plotPoints([], 100, 50)).toEqual([]);
  });
});

describe('interpret', () => {
  it('says so when there is nothing', () => {
    expect(interpret([])).toBe('No reading sessions yet.');
  });

  it('reads plainly for one session', () => {
    expect(interpret([session({ paragraphsViewed: 10, paragraphsFlipped: 4 })])).toBe(
      'In one session you read 40% of paragraphs in English.',
    );
  });

  it('needs ten sessions before it claims a trend', () => {
    const few = Array.from({ length: 9 }, (_, i) => session({ id: `s${i}` }));
    expect(interpret(few)).toBe('Across 9 sessions you read 40% of paragraphs in English.');
  });

  it('reports a fall once there is enough to compare', () => {
    const sessions = [
      ...Array.from({ length: 5 }, () =>
        session({ paragraphsViewed: 10, paragraphsFlipped: 6 }),
      ),
      ...Array.from({ length: 5 }, () =>
        session({ paragraphsViewed: 10, paragraphsFlipped: 2 }),
      ),
    ];
    expect(interpret(sessions)).toContain('over the last 5 it was 20%, less than before');
  });

  it('calls a small move no move at all', () => {
    const sessions = [
      ...Array.from({ length: 5 }, () =>
        session({ paragraphsViewed: 100, paragraphsFlipped: 40 }),
      ),
      ...Array.from({ length: 5 }, () =>
        session({ paragraphsViewed: 100, paragraphsFlipped: 41 }),
      ),
    ];
    expect(interpret(sessions)).toContain('about the same as before');
  });

  it('never congratulates', () => {
    const sessions = Array.from({ length: 12 }, () => session());
    expect(interpret(sessions)).not.toMatch(/well done|great|keep|nice|congrat|streak/i);
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
