import { describe, expect, it } from 'vitest';
import { movedTooFar, placeBubble } from './bubble';

const word = (top: number, left: number, width = 60) => ({
  top,
  bottom: top + 30,
  left,
  right: left + width,
});

describe('placeBubble', () => {
  it('sits above a word with room above it, centred on it', () => {
    const place = placeBubble(word(400, 150), 390);
    expect(place.above).toBe(true);
    expect(place.top).toBe(390);
    expect(place.left).toBe(180 - 288 / 2);
    expect(place.arrowX).toBe(288 / 2);
  });

  it('drops below a word near the top of the screen', () => {
    const place = placeBubble(word(80, 150), 390);
    expect(place.above).toBe(false);
    expect(place.top).toBe(120);
  });

  it('stays on screen for a word at the left edge, pointer still on the word', () => {
    const place = placeBubble(word(400, 20, 40), 390);
    expect(place.left).toBe(16);
    expect(place.arrowX).toBe(24);
  });

  it('stays on screen for a word at the right edge', () => {
    const place = placeBubble(word(400, 330, 40), 390);
    expect(place.left + place.width).toBe(390 - 16);
  });

  it('narrows to fit a small screen', () => {
    expect(placeBubble(word(400, 100), 300).width).toBe(268);
  });
});

describe('movedTooFar', () => {
  it('lets a finger settle', () => {
    expect(movedTooFar(4, 6)).toBe(false);
  });

  it('treats a real drag as movement', () => {
    expect(movedTooFar(0, 12)).toBe(true);
    expect(movedTooFar(9, 9)).toBe(true);
  });
});
