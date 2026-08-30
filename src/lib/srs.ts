import type { SavedWord } from '@/db/types';

/**
 * SM-2, as published. Nothing here is invented: the ease formula, the 1/6/×EF
 * interval ladder and the 1.3 ease floor are the algorithm as SuperMemo
 * defined it. Deviating would make the intervals unjustifiable.
 */

export const DAY = 24 * 60 * 60 * 1000;

/** The floor SM-2 puts under the ease factor. */
export const MIN_EASE = 1.3;

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** The four buttons, in the order they are shown. */
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy'];

export const GRADE_LABEL: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/**
 * SM-2 grades responses 0–5. Four buttons is the usable subset: a blackout, a
 * recall that hurt, a clean recall, and an effortless one.
 */
export const GRADE_Q: Record<Grade, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

/** A grade below 3 is a failure and restarts the ladder. */
const PASS = 3;

/** The numeric grade written to the review log. 1 Again … 4 Easy. */
export const GRADE_NUMBER: Record<Grade, 1 | 2 | 3 | 4> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

/**
 * Lapses before a word is called a leech.
 *
 * The received wisdom on a card failed this often is that the card is the
 * problem, not the memory — the sentence is too long, or the context gives
 * nothing away. Grinding it is how people come to dread the review screen.
 */
export const LEECH_LAPSES = 6;

/** Has this word failed often enough to be the card's fault rather than yours? */
export function isLeech(word: Pick<SavedWord, 'lapses'>): boolean {
  return word.lapses >= LEECH_LAPSES;
}

/**
 * EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)), floored at 1.3.
 *
 * Applied on every answer, including failures — that is what makes a word you
 * keep forgetting come back faster each time.
 */
export function nextEase(ease: number, q: number): number {
  const diff = 5 - q;
  return Math.max(MIN_EASE, ease + (0.1 - diff * (0.08 + diff * 0.02)));
}

/**
 * The next interval in days, given the repetition count *after* it is
 * incremented. I(1) = 1, I(2) = 6, I(n) = round(I(n-1) × EF).
 */
export function nextInterval(repetitions: number, previous: number, ease: number): number {
  if (repetitions <= 1) return 1;
  if (repetitions === 2) return 6;
  return Math.max(1, Math.round(previous * ease));
}

/**
 * Grade one card. Pure: returns a new word, touches nothing.
 *
 * A failure resets `repetitions` to zero and counts a lapse, so the word
 * climbs the ladder again from one day — but it keeps its reduced ease, and so
 * climbs more slowly than it did the first time.
 */
export function schedule(word: SavedWord, grade: Grade, now: number): SavedWord {
  const q = GRADE_Q[grade];
  const ease = nextEase(word.ease, q);
  const failed = q < PASS;

  const repetitions = failed ? 0 : word.repetitions + 1;
  const interval = failed ? 1 : nextInterval(repetitions, word.interval, ease);

  const lapses = failed ? word.lapses + 1 : word.lapses;
  const next: SavedWord = {
    ...word,
    ease,
    repetitions,
    interval,
    lapses,
    dueAt: now + interval * DAY,
  };

  // A leech is suspended where it falls rather than being forced round again.
  // It is not lost: it surfaces in the word list under "needs attention",
  // where the sentence behind it can be dealt with.
  //
  // Only ever on a failure. A card carrying old lapses that the reader has
  // just got right is a card being remembered, and suspending it for its
  // history would be a punishment for succeeding.
  if (failed && !word.leechFlaggedAt && isLeech(next)) {
    next.suspended = true;
    next.leechFlaggedAt = now;
  }

  return next;
}

/** What grading a card now would cost you, for the button labels. */
export function previewInterval(word: SavedWord, grade: Grade): number {
  return schedule(word, grade, 0).interval;
}

/** Cards whose time has come. */
export function dueWords<T extends { dueAt: number }>(words: T[], now: number): T[] {
  return words.filter((word) => word.dueAt <= now);
}

/** Fisher–Yates. `random` is injectable so the shuffle can be tested. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Compact enough for a button: 1d, 6d, 3w, 5mo, 2y. */
export function formatDays(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 36.5) / 10}y`;
}
