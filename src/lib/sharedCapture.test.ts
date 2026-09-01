import { describe, expect, it } from 'vitest';
import { sharedOutcome } from './sharedCapture';

describe('sharedOutcome', () => {
  it('reads the worker’s redirect', () => {
    expect(sharedOutcome('?shared=1')).toBe('ready');
    expect(sharedOutcome('?shared=empty')).toBe('empty');
    expect(sharedOutcome('?shared=failed')).toBe('failed');
  });

  it('is none for an ordinary visit', () => {
    expect(sharedOutcome('')).toBe('none');
    expect(sharedOutcome('?other=1')).toBe('none');
    // An unknown value is not a share we know how to honour.
    expect(sharedOutcome('?shared=yes')).toBe('none');
  });
});
