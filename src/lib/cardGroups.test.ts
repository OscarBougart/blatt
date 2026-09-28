import { describe, expect, it } from 'vitest';
import { countGroups, groupOf, lastGrades, parseGroup } from './cardGroups';

const log = (wordId: string, reviewedAt: number, grade: 1 | 2 | 3 | 4) => ({
  wordId,
  reviewedAt,
  grade,
});

describe('lastGrades', () => {
  it('keeps only the most recent grade for each word', () => {
    const grades = lastGrades([log('a', 1, 4), log('a', 3, 1), log('a', 2, 3), log('b', 5, 2)]);
    expect(grades.get('a')).toBe('hard');
    expect(grades.get('b')).toBe('medium');
  });

  it('does not depend on the order of the log', () => {
    const forward = lastGrades([log('a', 1, 1), log('a', 2, 4)]);
    const backward = lastGrades([log('a', 2, 4), log('a', 1, 1)]);
    expect(forward.get('a')).toBe('easy');
    expect(backward.get('a')).toBe('easy');
  });
});

describe('countGroups', () => {
  it('puts a word with no reviews in the new group', () => {
    const grades = lastGrades([log('a', 1, 3)]);
    expect(groupOf('a', grades)).toBe('good');
    expect(groupOf('b', grades)).toBe('new');
  });

  it('counts every saved word exactly once, with every group present', () => {
    const grades = lastGrades([log('a', 1, 1), log('b', 1, 3), log('c', 1, 3)]);
    const counts = countGroups([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], grades);
    expect(counts).toEqual({ hard: 1, medium: 0, good: 2, easy: 0, new: 1 });
  });

  it('ignores reviews of words that are no longer saved', () => {
    const grades = lastGrades([log('gone', 1, 1)]);
    expect(countGroups([], grades)).toEqual({ hard: 0, medium: 0, good: 0, easy: 0, new: 0 });
  });
});

describe('parseGroup', () => {
  it('accepts the five groups and nothing else', () => {
    expect(parseGroup('hard')).toBe('hard');
    expect(parseGroup('new')).toBe('new');
    expect(parseGroup('again')).toBeNull();
    expect(parseGroup(null)).toBeNull();
  });
});
