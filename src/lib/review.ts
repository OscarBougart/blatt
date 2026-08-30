import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { newId } from './id';
import { DAY, GRADE_NUMBER, schedule, type Grade } from './srs';

/**
 * Grading a card: the schedule, and the record of it.
 *
 * The log is written on every grade press without exception, and that is the
 * point of it. FSRS — the algorithm that replaced SM-2 as Anki's default —
 * trains on review history, so a log kept from the beginning is the difference
 * between changing scheduler one day and starting again from nothing. It
 * cannot be reconstructed later: a card carries its current state, never the
 * path it took to get there.
 */

export interface GradeResult {
  word: SavedWord;
  /** True when this grade turned the card into a leech. */
  flaggedLeech: boolean;
}

/**
 * Apply a grade: write the new schedule and one log row, in one transaction.
 *
 * Both or neither. A card whose schedule moved without a log entry is a hole
 * in the history that nothing can fill in afterwards.
 */
export async function gradeCard(
  word: SavedWord,
  grade: Grade,
  durationMs: number,
  now: number = Date.now(),
): Promise<GradeResult> {
  const next = schedule(word, grade, now);

  // What actually happened, which is rarely what was scheduled: a card due on
  // Tuesday and answered on Friday elapsed three days more than planned, and
  // that gap is exactly what a history-based scheduler learns from.
  const lastReviewedAt = word.dueAt - word.interval * DAY;
  const elapsedDays = Math.max(0, (now - lastReviewedAt) / DAY);

  await db.transaction('rw', [db.words, db.reviews], async () => {
    await db.words.update(word.id, {
      ease: next.ease,
      interval: next.interval,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      suspended: next.suspended,
      leechFlaggedAt: next.leechFlaggedAt,
    });

    await db.reviews.add({
      id: newId(),
      wordId: word.id,
      reviewedAt: now,
      grade: GRADE_NUMBER[grade],
      intervalBefore: word.interval,
      easeBefore: word.ease,
      elapsedDays,
      durationMs,
    });
  });

  return {
    word: next,
    flaggedLeech: next.leechFlaggedAt !== undefined && word.leechFlaggedAt === undefined,
  };
}

/** Mark words as having entered review. A saved word is not a card until this. */
export async function introduce(words: SavedWord[], now: number = Date.now()): Promise<void> {
  if (words.length === 0) return;
  await db.transaction('rw', db.words, async () => {
    for (const word of words) {
      await db.words.update(word.id, { introducedAt: now });
    }
  });
}
