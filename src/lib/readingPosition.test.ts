import { describe, expect, it } from 'vitest';
import { positionOf, scrollTopFor, type Paragraph } from './readingPosition';

/** Roughly the demo text: a short opener, then a paragraph taller than a phone. */
const PARAGRAPHS: Paragraph[] = [
  { top: 64, height: 345 },
  { top: 437, height: 972 },
  { top: 1437, height: 314 },
  { top: 1778, height: 627 },
];

const VIEWPORT = 695;

describe('positionOf', () => {
  it('starts at the first paragraph', () => {
    expect(positionOf(PARAGRAPHS, 0, VIEWPORT).index).toBe(0);
  });

  it('follows the reader down the column', () => {
    expect(positionOf(PARAGRAPHS, 500, VIEWPORT).index).toBe(1);
    expect(positionOf(PARAGRAPHS, 1500, VIEWPORT).index).toBe(2);
    expect(positionOf(PARAGRAPHS, 1900, VIEWPORT).index).toBe(3);
  });

  it('stays in a paragraph taller than the screen', () => {
    // The case that broke the old rule: 972px of text on a 695px screen can
    // never be "half visible", so it used to be skipped entirely.
    // Up to the point the next paragraph actually reaches the eyeline.
    for (const scrollTop of [500, 800, 1100, 1280]) {
      expect(positionOf(PARAGRAPHS, scrollTop, VIEWPORT).index).toBe(1);
    }
  });

  it('reports how far into the paragraph the reader is', () => {
    const { index, fraction } = positionOf(PARAGRAPHS, 923, VIEWPORT);
    expect(index).toBe(1);
    expect(fraction).toBeCloseTo((923 - 437) / 972, 5);
  });

  it('clamps the fraction to the paragraph', () => {
    expect(positionOf(PARAGRAPHS, 440, VIEWPORT).fraction).toBeGreaterThanOrEqual(0);
    expect(positionOf(PARAGRAPHS, 100000, VIEWPORT).fraction).toBeLessThanOrEqual(1);
  });

  it('has an answer for an empty document', () => {
    expect(positionOf([], 0, VIEWPORT)).toEqual({ index: 0, fraction: 0 });
  });

  it('survives a paragraph of no height', () => {
    expect(positionOf([{ top: 0, height: 0 }], 0, VIEWPORT).fraction).toBe(0);
  });
});

describe('scrollTopFor', () => {
  /** The same story in English: same count, different lengths. */
  const ENGLISH: Paragraph[] = [
    { top: 64, height: 314 },
    { top: 406, height: 878 },
    { top: 1311, height: 314 },
    { top: 1653, height: 658 },
  ];

  it('lands at the top of the matching paragraph when the reader is at its top', () => {
    expect(scrollTopFor(ENGLISH, { index: 2, fraction: 0 }, 28)).toBe(1311 - 28);
  });

  it('carries the fraction across, not just the paragraph', () => {
    // Halfway through a 972px German paragraph should be halfway through the
    // 878px English one — not back at its first line, a page and a half up.
    expect(scrollTopFor(ENGLISH, { index: 1, fraction: 0.5 }, 28)).toBe(406 + 439 - 28);
  });

  it('never scrolls above the top of the column', () => {
    expect(scrollTopFor(ENGLISH, { index: 0, fraction: 0 }, 200)).toBe(0);
  });

  it('has an answer for a paragraph that is not there', () => {
    expect(scrollTopFor(ENGLISH, { index: 99, fraction: 0.5 }, 28)).toBe(0);
  });

  it('round-trips a position between two columns', () => {
    const german = positionOf(PARAGRAPHS, 923, VIEWPORT);
    const englishScroll = scrollTopFor(ENGLISH, german, 0);
    const back = positionOf(ENGLISH, englishScroll, VIEWPORT);
    expect(back.index).toBe(german.index);
    expect(back.fraction).toBeCloseTo(german.fraction, 5);
  });
});
