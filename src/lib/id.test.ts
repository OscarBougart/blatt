import { describe, expect, it, vi, afterEach } from 'vitest';
import { newId } from './id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newId', () => {
  it('uses crypto.randomUUID when it exists', () => {
    expect(newId()).toMatch(UUID);
  });

  // The actual failure: a phone on http://192.168.x.x has no randomUUID.
  it('falls back to getRandomValues in a non-secure context', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const id = newId();
    expect(id).toMatch(UUID);
  });

  it('still returns something unique with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});
