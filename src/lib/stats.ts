import type { Session } from '@/db/types';

/**
 * The one honest statistic, prepared for display.
 *
 * Flip rate is the share of paragraphs you had to read in English. It is not a
 * score: a high rate on a hard text is the correct outcome, and the app never
 * says otherwise. All of this is pure so the shape of the number can be tested
 * without a database or a chart.
 */

/** Sessions shorter than this are noise — a document opened and closed. */
export const MIN_PARAGRAPHS = 3;

/** How many recent sessions the trend sentence compares against. */
export const RECENT = 5;

export function duration(session: Session): number {
  return Math.max(0, (session.endedAt ?? session.startedAt) - session.startedAt);
}

/** "6 min", "1 h 12 min". Seconds are never interesting here. */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Real, finished sessions, oldest first.
 *
 * A session with no `endedAt` has no duration to report, so reporting one
 * would mean inventing it. Unfinished rows are also what a browser leaves
 * behind when it takes the page away mid-read, and those are rubbish rather
 * than reading.
 */
export function readableSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.endedAt !== undefined && s.paragraphsViewed >= MIN_PARAGRAPHS)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * Flip rate across several sessions, weighted by paragraphs read.
 *
 * Averaging the per-session rates would let a three-paragraph session count
 * as much as an hour's reading.
 */
export function combinedRate(sessions: Session[]): number {
  let viewed = 0;
  let flipped = 0;
  for (const session of sessions) {
    viewed += session.paragraphsViewed;
    flipped += session.paragraphsFlipped;
  }
  return viewed === 0 ? 0 : flipped / viewed;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Session rates as coordinates in a `width` x `height` box, oldest at the left.
 *
 * The y axis is pinned to 0–1 rather than scaled to the data: an axis that
 * rescaled itself would turn a wobble between 30% and 34% into a dramatic
 * mountain range, which would be a lie told with a straight face.
 */
export function plotPoints(sessions: Session[], width: number, height: number): Point[] {
  if (sessions.length === 0) return [];
  if (sessions.length === 1) {
    return [{ x: width / 2, y: height * (1 - sessions[0].flipRate) }];
  }

  const step = width / (sessions.length - 1);
  return sessions.map((session, i) => ({
    x: i * step,
    y: height * (1 - Math.min(1, Math.max(0, session.flipRate))),
  }));
}

/**
 * One sentence. What the number is, and which way it is moving.
 *
 * Deliberately flat: no "well done", no "keep it up". A flip rate that went up
 * because the text got harder is not a failure, and the app is in no position
 * to know the difference.
 */
export function interpret(sessions: Session[]): string {
  if (sessions.length === 0) return 'No reading sessions yet.';

  const overall = formatRate(combinedRate(sessions));

  if (sessions.length < RECENT * 2) {
    const plural = sessions.length === 1 ? 'session' : `${sessions.length} sessions`;
    const across = sessions.length === 1 ? 'In one session' : `Across ${plural}`;
    return `${across} you read ${overall} of paragraphs in English.`;
  }

  const recent = sessions.slice(-RECENT);
  const earlier = sessions.slice(0, -RECENT);
  const recentRate = combinedRate(recent);
  const earlierRate = combinedRate(earlier);
  const change = recentRate - earlierRate;

  // Under two points either way is not a trend, it is the same number.
  const direction =
    Math.abs(change) < 0.02
      ? 'about the same as before'
      : change < 0
        ? 'less than before'
        : 'more than before';

  return `Across ${sessions.length} sessions you read ${overall} of paragraphs in English; over the last ${RECENT} it was ${formatRate(recentRate)}, ${direction}.`;
}

/**
 * Two diagnostics the review log makes possible.
 *
 * Both are deliberately minor: shown small, in graphite, below the flip rate.
 * Neither is a score. Reviews per day is there so the pile can be seen coming
 * rather than discovered; median grading time is there because a number that
 * climbs means the cards have got too hard, which is a fact about the deck
 * rather than about the reader.
 */

/** Days of history the reviews-per-day strip covers. */
export const REVIEW_HISTORY_DAYS = 30;

/** Local midnight, so days break where the reader lives. */
function dayKey(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Reviews per day, oldest first, one entry per day including the empty ones.
 *
 * The gaps are the point: a strip with holes in it says something a list of
 * only-active days would hide.
 */
export function reviewsPerDay(
  logs: { reviewedAt: number }[],
  now: number,
  days = REVIEW_HISTORY_DAYS,
): { day: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const log of logs) {
    const key = dayKey(log.reviewedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = dayKey(now);
  return Array.from({ length: days }, (_, i) => {
    // Built by subtracting whole days from local midnight, so a clock change
    // shifts the boundary rather than dropping or duplicating a day.
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - i));
    const day = date.getTime();
    return { day, count: counts.get(day) ?? 0 };
  });
}

/**
 * Median grading time, in milliseconds. Null when there is nothing to say.
 *
 * The median rather than the mean: one card left on screen while the phone
 * was put down would drag an average into meaninglessness.
 */
export function medianDuration(logs: { durationMs: number }[]): number | null {
  const times = logs
    .map((log) => log.durationMs)
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b);

  if (times.length === 0) return null;

  const middle = Math.floor(times.length / 2);
  return times.length % 2 === 0 ? (times[middle - 1] + times[middle]) / 2 : times[middle];
}

/** "4.2s". Grading is a seconds-long act; anything else is the wrong unit. */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
