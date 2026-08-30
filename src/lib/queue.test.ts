import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import {
  DEFAULT_NEW_PER_DAY,
  MAX_NEW_PER_DAY,
  MIN_NEW_PER_DAY,
  clampNewPerDay,
  composeSession,
  introducedToday,
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

const noShuffle = () => 0;

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

describe('composeSession', () => {
  it('takes everything due and tops up with new words', () => {
    const words = [card(1), card(2), waiting(1), waiting(2), waiting(3)];
    const { due, fresh } = composeSession(words, { newPerDay: 8, now: NOW, random: noShuffle });
    expect(due).toHaveLength(2);
    expect(fresh).toHaveLength(3);
  });

  it('never introduces more than the daily limit', () => {
    const words = Array.from({ length: 30 }, (_, i) => waiting(i));
    const { fresh } = composeSession(words, { newPerDay: 5, now: NOW, random: noShuffle });
    expect(fresh).toHaveLength(5);
  });

  it('counts what was already introduced today against the limit', () => {
    const words = [
      ...Array.from({ length: 6 }, (_, i) => card(i, { introducedAt: NOW - 1000 })),
      ...Array.from({ length: 10 }, (_, i) => waiting(i)),
    ];
    // Six of today's eight are spent, so two remain.
    const { fresh } = composeSession(words, { newPerDay: 8, now: NOW, random: noShuffle });
    expect(fresh).toHaveLength(2);
  });

  it('lets the backlog crowd out new words entirely', () => {
    // Falling behind is what ends the habit, so due cards outrank appetite.
    const words = [
      ...Array.from({ length: 25 }, (_, i) => card(i)),
      ...Array.from({ length: 5 }, (_, i) => waiting(i)),
    ];
    const { due, fresh } = composeSession(words, { newPerDay: 8, now: NOW, random: noShuffle });
    expect(due).toHaveLength(20);
    expect(fresh).toHaveLength(0);
  });

  it('never exceeds the session cap in total', () => {
    const words = [
      ...Array.from({ length: 15 }, (_, i) => card(i)),
      ...Array.from({ length: 20 }, (_, i) => waiting(i)),
    ];
    const { due, fresh } = composeSession(words, { newPerDay: 20, now: NOW, random: noShuffle });
    expect(due.length + fresh.length).toBe(20);
  });

  it('introduces the words that have waited longest', () => {
    const words = [
      waiting(1, { id: 'newest', createdAt: NOW }),
      waiting(2, { id: 'oldest', createdAt: NOW - 30 * DAY }),
      waiting(3, { id: 'middle', createdAt: NOW - 5 * DAY }),
      waiting(4, { id: 'recent', createdAt: NOW - DAY }),
    ];
    const { fresh } = composeSession(words, { newPerDay: 3, now: NOW, random: noShuffle });
    expect(fresh.map((w) => w.id)).toEqual(['oldest', 'middle', 'recent']);
  });

  it('holds the daily limit to its range', () => {
    const words = Array.from({ length: 30 }, (_, i) => waiting(i));
    // Below the floor and above the ceiling both get clamped, so a stored
    // setting that has been tampered with cannot bury the reader or starve them.
    expect(composeSession(words, { newPerDay: 1, now: NOW, random: noShuffle }).fresh)
      .toHaveLength(MIN_NEW_PER_DAY);
    expect(composeSession(words, { newPerDay: 500, now: NOW, random: noShuffle }).fresh)
      .toHaveLength(MAX_NEW_PER_DAY);
  });

  it('leaves suspended words out of both halves', () => {
    const words = [
      card(1, { suspended: true }),
      waiting(2, { suspended: true }),
      card(3),
    ];
    const { due, fresh } = composeSession(words, { newPerDay: 8, now: NOW, random: noShuffle });
    expect(due.map((w) => w.id)).toEqual(['c3']);
    expect(fresh).toHaveLength(0);
  });

  it('does not schedule a card before it is due', () => {
    const words = [card(1, { dueAt: NOW + DAY })];
    const { due } = composeSession(words, { newPerDay: 8, now: NOW, random: noShuffle });
    expect(due).toHaveLength(0);
  });
});
