import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DictEntry } from '@/db/types';

const store = new Map<string, DictEntry>();

vi.mock('@/db/db', () => ({
  db: {
    dict: {
      get: async (lemma: string) => store.get(lemma),
      put: async (entry: DictEntry) => void store.set(entry.lemma, entry),
    },
  },
}));

const fetched = vi.fn<(lemma: string) => Promise<string[]>>();
vi.mock('./dictApi', () => ({ fetchDefinitions: (lemma: string) => fetched(lemma) }));

const { lookupDefinition } = await import('./dict');

const glosses: Record<string, string[]> = {
  Dann: [],
  dann: ['adverb: then'],
  Essen: ['noun: food'],
  essen: ['verb: to eat'],
  nichts: [],
};

beforeEach(() => {
  store.clear();
  fetched.mockReset();
  fetched.mockImplementation(async (lemma) => glosses[lemma] ?? []);
});

describe('lookupDefinition', () => {
  it('falls back to the lowercase when the capitalised lemma is empty', async () => {
    expect((await lookupDefinition('Dann'))?.definitions).toEqual(['adverb: then']);
  });

  it('repairs a cached empty entry from an earlier import', async () => {
    store.set('Dann', { lemma: 'Dann', definitions: [], fetchedAt: 0, source: 'wiktionary' });
    expect((await lookupDefinition('Dann'))?.definitions).toEqual(['adverb: then']);
  });

  it('keeps a capitalised noun that has its own definitions', async () => {
    expect((await lookupDefinition('Essen'))?.definitions).toEqual(['noun: food']);
    expect(fetched).not.toHaveBeenCalledWith('essen');
  });

  it('does not retry a lowercase lemma', async () => {
    expect((await lookupDefinition('nichts'))?.definitions).toEqual([]);
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it('returns null when the network fails', async () => {
    fetched.mockRejectedValue(new Error('offline'));
    expect(await lookupDefinition('Dann')).toBeNull();
  });
});
