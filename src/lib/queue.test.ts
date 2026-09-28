import { describe, expect, it } from 'vitest';
import type { SavedWord } from '@/db/types';
import { reviewSession, isCard, isWaiting } from './queue';

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

describe('reviewSession', () => {
  it('fills the round to the limit', () => {
    const words = [card(1), card(2), card(3), card(4), card(5), card(6)];
    const { cards, fresh } = reviewSession(words, { limit: 5 });

    expect(cards).toHaveLength(5);
    expect(fresh).toHaveLength(0);
  });

  it('draws soonest due first, so hard words come round more often', () => {
    const words = [
      card(1, { id: 'far', dueAt: NOW + 30 * DAY }),
      card(2, { id: 'soon', dueAt: NOW + DAY }),
      card(3, { id: 'sooner', dueAt: NOW - DAY }),
    ];
    const { cards } = reviewSession(words, { limit: 2 });

    expect(cards.map((w) => w.id)).toEqual(['sooner', 'soon']);
  });

  it('deals cards that are not due yet rather than an empty round', () => {
    const words = [card(1, { dueAt: NOW + 30 * DAY }), card(2, { dueAt: NOW + 60 * DAY })];
    const { cards } = reviewSession(words, { limit: 5 });

    expect(cards).toHaveLength(2);
  });

  it('introduces new words oldest first', () => {
    const words = [waiting(1), waiting(2), waiting(3)];
    const { fresh } = reviewSession(words, { limit: 10 });

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
    const { cards, fresh } = reviewSession(words, { limit: 6 });

    expect(fresh).toHaveLength(3);
    expect(cards).toHaveLength(3);
  });

  it('tops the round up with new words when there are too few cards', () => {
    const words = [card(1), card(2), ...Array.from({ length: 20 }, (_, i) => waiting(i + 1))];
    const { cards, fresh } = reviewSession(words, { limit: 20 });

    // Two cards cannot fill half of twenty; new words make up the rest.
    expect(cards).toHaveLength(2);
    expect(fresh).toHaveLength(18);
  });

  it('has no daily cap: a big round of new words is a big round', () => {
    const words = Array.from({ length: 25 }, (_, i) => waiting(i + 1));
    expect(reviewSession(words, { limit: 20 }).fresh).toHaveLength(20);
  });

  it('is short only when there are not enough words saved', () => {
    const { cards, fresh } = reviewSession([card(1), waiting(1), waiting(2)], { limit: 10 });
    expect(cards.length + fresh.length).toBe(3);
  });

  it('leaves suspended words out entirely', () => {
    const words = [card(1, { suspended: true }), waiting(2, { suspended: true })];
    const { cards, fresh } = reviewSession(words, { limit: 5 });

    expect(cards).toHaveLength(0);
    expect(fresh).toHaveLength(0);
  });
});
