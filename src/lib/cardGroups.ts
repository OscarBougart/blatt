import type { ReviewLog, SavedWord } from '@/db/types';
import { GRADES, GRADE_NUMBER, type Grade } from './srs';

/**
 * Saved words, grouped by the grade the reader last gave them.
 *
 * Not a score. It is where the vocabulary stands today: a card moves group
 * every time it is graded again, so nothing here only ever grows. A word never
 * reviewed has no grade yet and sits in its own group.
 */

export type CardGroup = Grade | 'new';

/** Display order: the four grades as the buttons show them, then the unreviewed. */
export const CARD_GROUPS: CardGroup[] = [...GRADES, 'new'];

export const CARD_GROUP_LABEL: Record<CardGroup, string> = {
  hard: 'Hard',
  medium: 'Medium',
  good: 'Good',
  easy: 'Easy',
  new: 'Not reviewed yet',
};

/** The log stores grades by position (1 hardest to 4 easiest); map them back. */
const GRADE_BY_NUMBER = new Map(GRADES.map((grade) => [GRADE_NUMBER[grade], grade]));

/** Each word's most recent grade, from the review log. */
export function lastGrades(logs: Pick<ReviewLog, 'wordId' | 'reviewedAt' | 'grade'>[]) {
  const latest = new Map<string, { at: number; grade: Grade }>();
  for (const log of logs) {
    const grade = GRADE_BY_NUMBER.get(log.grade);
    if (!grade) continue;
    const seen = latest.get(log.wordId);
    if (!seen || log.reviewedAt > seen.at) latest.set(log.wordId, { at: log.reviewedAt, grade });
  }
  return new Map([...latest].map(([wordId, { grade }]) => [wordId, grade]));
}

export function groupOf(wordId: string, grades: Map<string, Grade>): CardGroup {
  return grades.get(wordId) ?? 'new';
}

/** How many saved words fall in each group. Every group is present, even at 0. */
export function countGroups(
  words: Pick<SavedWord, 'id'>[],
  grades: Map<string, Grade>,
): Record<CardGroup, number> {
  const counts: Record<CardGroup, number> = { hard: 0, medium: 0, good: 0, easy: 0, new: 0 };
  for (const word of words) counts[groupOf(word.id, grades)] += 1;
  return counts;
}

/** Read a group from a URL parameter. Anything unrecognised means no filter. */
export function parseGroup(value: string | null): CardGroup | null {
  return CARD_GROUPS.find((group) => group === value) ?? null;
}
