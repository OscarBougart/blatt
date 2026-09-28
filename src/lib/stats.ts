import type { Session } from '@/db/types';

/**
 * The one honest statistic: how many times the reader flipped to English.
 *
 * Every flip counts, a glance as much as a paragraph read through, because
 * each one is a moment the reader reached for the translation. It is not a
 * score: a hard text should be flipped more, and the app never says
 * otherwise. All of this is pure so the numbers can be tested without a
 * database.
 *
 * Flips have only been counted since the counter was added. A session from
 * before then has no `flips` at all, which is not the same as zero, so every
 * total here is taken over counted sessions only.
 */

/** Sessions that carry a flip count. */
export function countedSessions(sessions: Session[]): Session[] {
  return sessions.filter((session) => session.flips !== undefined);
}

export function totalFlips(sessions: Session[]): number {
  return countedSessions(sessions).reduce((sum, session) => sum + (session.flips ?? 0), 0);
}

/** When counting began: the first counted session. Null before there is one. */
export function countingSince(sessions: Session[]): number | null {
  const counted = countedSessions(sessions);
  if (counted.length === 0) return null;
  return Math.min(...counted.map((session) => session.startedAt));
}

export interface TextFlips {
  docId: string;
  flips: number;
}

/**
 * Flips per text, most first. Which texts sent the reader to the English
 * most, and which they read without it: something to choose the next text by.
 */
export function flipsByText(sessions: Session[]): TextFlips[] {
  const byDoc = new Map<string, number>();
  for (const session of countedSessions(sessions)) {
    byDoc.set(session.docId, (byDoc.get(session.docId) ?? 0) + (session.flips ?? 0));
  }
  return [...byDoc]
    .map(([docId, flips]) => ({ docId, flips }))
    .sort((a, b) => b.flips - a.flips);
}

/**
 * Two diagnostics the review log makes possible.
 *
 * Both are deliberately minor: shown small, in graphite, below the flips.
 * Neither is a score. Reviews per day is there so the pile can be seen coming
 * rather than discovered; median grading time is there because a number that
 * climbs means the cards have got too hard, which is a fact about the deck
 * rather than about the reader.
 */

/** Days of history the review count covers. */
export const REVIEW_HISTORY_DAYS = 30;

/** Local midnight, so days break where the reader lives. */
function dayKey(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Reviews per day, oldest first, one entry per day including the empty ones.
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
