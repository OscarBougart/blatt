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

/** Real sessions, oldest first. */
export function readableSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.paragraphsViewed >= MIN_PARAGRAPHS)
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
