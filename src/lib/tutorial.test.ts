import { describe, expect, it } from 'vitest';
import { advance } from './tutorial';

describe('advance', () => {
  it('walks flip → return → save → done on the right gestures', () => {
    expect(advance('flip', 'en')).toBe('return');
    expect(advance('return', 'de')).toBe('save');
    expect(advance('save', 'saved')).toBe('done');
  });

  it('ignores gestures out of order', () => {
    expect(advance('flip', 'saved')).toBe('flip');
    expect(advance('flip', 'de')).toBe('flip');
    expect(advance('return', 'saved')).toBe('return');
    expect(advance('save', 'en')).toBe('save');
  });

  it('stays done', () => {
    expect(advance('done', 'en')).toBe('done');
    expect(advance('done', 'de')).toBe('done');
    expect(advance('done', 'saved')).toBe('done');
  });
});
