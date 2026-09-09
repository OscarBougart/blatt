import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import {
  DEFAULT_NEW_PER_DAY,
  MAX_NEW_PER_DAY,
  MIN_NEW_PER_DAY,
  clampNewPerDay,
  introducedToday,
  reviewSession,
  isCard,
  isWaiting,
  startOfDay,
} from './queue';

const NOW = new Date('2026-08-30T14:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

function word(overrides: Partial<SavedWord> = {}): SavedWord {
  return {
    id: 'w1',
    surface: 'Frosch',
    lemma: 'Frosch',
    definition: 'frog',
    sentence: 'Der Frosch sprang.',
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

/** A card in review and due now. */
const card = (i: number, extra: Partial<SavedWord> = {}) =>
  word({ id: `c${i}`, introducedAt: NOW - 10 * DAY, dueAt: NOW - 1000, ...extra });

/** A saved word still waiting in the queue. */
const waiting = (i: number, extra: Partial<SavedWord> = {}) =>
  word({ id: `n${i}`, introducedAt: undefined, createdAt: NOW - i * 1000, ...extra });

describe('clampNewPerDay', () => {
  it('holds the range', () => {
    expect(clampNewPerDay(1)).toBe(MIN_NEW_PER_DAY);
    expect(clampNewPerDay(50)).toBe(MAX_NEW_PER_DAY);
    expect(clampNewPerDay(8)).toBe(8);
  });

  it('falls back to the default on nonsense', () => {
    expect(clampNewPerDay(Number.NaN)).toBe(DEFAULT_NEW_PER_DAY);
  });
});

describe('startOfDay', () => {
  it('rolls over at local midnight', () => {
    expect(new Date(startOfDay(NOW)).getHours()).toBe(0);
    expect(startOfDay(NOW)).toBeLessThanOrEqual(NOW);
  });
});

describe('isCard / isWaiting', () => {
  it('separates cards, queue and suspended', () => {
    expect(isCard(card(1))).toBe(true);
    expect(isWaiting(card(1))).toBe(false);

    expect(isCard(waiting(1))).toBe(false);
    expect(isWaiting(waiting(1))).toBe(true);

    const suspended = card(1, { suspended: true });
    expect(isCard(suspended)).toBe(false);
    expect(isWaiting(suspended)).toBe(false);
  });
});

describe('introducedToday', () => {
  it('counts only what was introduced since local midnight', () => {
    const words = [
      card(1, { introducedAt: NOW - 1000 }),
      card(2, { introducedAt: NOW - 2000 }),
      card(3, { introducedAt: startOfDay(NOW) - 1000 }),
      waiting(4),
    ];
    expect(introducedToday(words, NOW)).toBe(2);
  });
});

describe('reviewSession', () => {
  it('fills the round to the limit', () => {
    const words = [card(1), card(2), card(3), card(4), card(5), card(6)];
    const { cards, fresh } = reviewSession(words, { limit: 5, newPerDay: 8, now: NOW });

    expect(cards).toHaveLength(5);
    expect(fresh).toHaveLength(0);
  });

  it('draws soonest due first, so hard words come round more often', () => {
    const words = [
      card(1, { id: 'far', dueAt: NOW + 30 * DAY }),
      card(2, { id: 'soon', dueAt: NOW + DAY }),
      card(3, { id: 'sooner', dueAt: NOW - DAY }),
    ];
    const { cards } = reviewSession(words, { limit: 2, newPerDay: 0, now: NOW });

    expect(cards.map((w) => w.id)).toEqual(['sooner', 'soon']);
  });

  it('deals cards that are not due yet rather than an empty round', () => {
    const words = [card(1, { dueAt: NOW + 30 * DAY }), card(2, { dueAt: NOW + 60 * DAY })];
    const { cards } = reviewSession(words, { limit: 5, newPerDay: 0, now: NOW });

    expect(cards).toHaveLength(2);
  });

  it('introduces new words oldest first', () => {
    const words = [waiting(1), waiting(2), waiting(3)];
    const { fresh } = reviewSession(words, { limit: 10, newPerDay: 8, now: NOW });

    // `waiting(i)` is created i seconds ago, so the higher index is the older.
    expect(fresh.map((w) => w.id)).toEqual(['n3', 'n2', 'n1']);
  });

  it('gives new words at most half the round', () => {
    const words = [
      waiting(1),
      waiting(2),
      waiting(3),
      waiting(4),
      waiting(5),
      waiting(6),
      card(1),
      card(2),
      card(3),
    ];
    const { cards, fresh } = reviewSession(words, { limit: 6, newPerDay: 20, now: NOW });

    expect(fresh).toHaveLength(3);
    expect(cards).toHaveLength(3);
  });

  it('spends the daily allowance on new words, not the round limit', () => {
    const words = [waiting(1), waiting(2), waiting(3), waiting(4)];
    const introducedAlready = [card(1, { introducedAt: NOW - 1000 })];
    const { fresh } = reviewSession([...words, ...introducedAlready], {
      limit: 10,
      newPerDay: 3,
      now: NOW,
    });

    // Three a day, one already introduced today: two left.
    expect(fresh).toHaveLength(2);
  });

  it('leaves suspended words out entirely', () => {
    const words = [card(1, { suspended: true }), waiting(2, { suspended: true })];
    const { cards, fresh } = reviewSession(words, { limit: 5, newPerDay: 8, now: NOW });

    expect(cards).toHaveLength(0);
    expect(fresh).toHaveLength(0);
  });
});
