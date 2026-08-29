import { describe, expect, it } from 'vitest';
import { swipeDirection } from './swipe';
import { flipRate } from './flipRate';

describe('swipeDirection', () => {
  it('commits right on a clean rightward drag', () => {
    expect(swipeDirection(100, 0)).toBe('right');
  });

  it('commits left on a clean leftward drag', () => {
    expect(swipeDirection(-100, 0)).toBe('left');
  });

  it('ignores a drag that has not travelled far enough', () => {
    expect(swipeDirection(55, 0)).toBeNull();
    expect(swipeDirection(-55, 0)).toBeNull();
  });

  it('commits exactly at the distance threshold', () => {
    expect(swipeDirection(56, 0)).toBe('right');
  });

  // The whole point: reading is vertical, so vertical intent must win.
  it('ignores a vertical scroll with incidental horizontal drift', () => {
    expect(swipeDirection(60, 200)).toBeNull();
    expect(swipeDirection(-60, 200)).toBeNull();
  });

  it('ignores a diagonal drag that does not beat vertical 2:1', () => {
    expect(swipeDirection(100, 60)).toBeNull();
  });

  it('commits when horizontal beats vertical exactly 2:1', () => {
    expect(swipeDirection(100, 50)).toBe('right');
  });

  it('treats upward and downward drift the same', () => {
    expect(swipeDirection(100, -60)).toBeNull();
    expect(swipeDirection(100, -50)).toBe('right');
  });

  it('never commits on a purely vertical drag', () => {
    expect(swipeDirection(0, 300)).toBeNull();
  });
});

describe('flipRate', () => {
  it('is zero before anything has been read', () => {
    expect(flipRate(0, 0)).toBe(0);
  });

  it('does not divide by zero if a flip somehow precedes a view', () => {
    expect(flipRate(0, 3)).toBe(0);
  });

  it('is the share of read paragraphs that were flipped', () => {
    expect(flipRate(20, 5)).toBe(0.25);
  });

  it('reaches one when every paragraph was flipped', () => {
    expect(flipRate(8, 8)).toBe(1);
  });
});
