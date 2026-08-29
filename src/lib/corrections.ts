import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { lookupDefinition } from '@/lib/dict';
import { rank, type LemmaCandidate } from '@/lib/lemma/types';

/**
 * Corrections made in the word list.
 *
 * The reading view has no word sheet on purpose, so this is the only place a
 * mistake gets fixed — and a fix here has to stick everywhere, or the same
 * wrong lemma comes back the next time the word is tapped.
 */

/**
 * Change the lemma for a saved word.
 *
 * Writes back three ways: the word itself, the document's `lemmaMap` so the
 * next tap on that surface form agrees, and a definition fetch for the new
 * lemma. The corrected lemma is stored with `method: 'manual'` at full
 * confidence, so it outranks anything the cascade guessed and stops the word
 * showing up under "needs attention" again.
 */
export async function setLemma(word: SavedWord, lemma: string): Promise<void> {
  const next = lemma.trim();
  if (!next || next === word.lemma) return;

  await db.words.update(word.id, { lemma: next });

  const doc = await db.docs.get(word.docId);
  if (doc) {
    const existing: LemmaCandidate[] = doc.lemmaMap?.[word.surface] ?? [];
    // Demote any earlier manual choice rather than deleting it: the newest
    // correction must win, but a lemma the reader once picked is exactly the
    // one they are most likely to want to cycle back to. Two `manual` entries
    // left tied at 1 would be settled alphabetically, which would leave the
    // correction you just replaced still ranked first.
    const corrected = rank([
      { lemma: next, confidence: 1, method: 'manual' },
      ...existing
        .filter((c) => c.lemma !== next)
        .map((c) => (c.method === 'manual' ? { ...c, confidence: 0.9 } : c)),
    ]);
    await db.docs.update(doc.id, {
      lemmaMap: { ...(doc.lemmaMap ?? {}), [word.surface]: corrected },
    });
  }

  // The old definition belonged to the old lemma. Replace it, or clear it.
  const entry = await lookupDefinition(next);
  await db.words.update(word.id, {
    definition: entry?.definitions[0] ?? '',
    lookupFailed: entry ? undefined : true,
  });
}

/**
 * Store the reader's own definition.
 *
 * Kept in `note` rather than overwriting `definition`, so a hand-written gloss
 * is never silently replaced by a later dictionary fetch. It is also written to
 * the permanent cache as a `manual` entry, so every future occurrence of the
 * lemma gets the reader's own wording instead of Wiktionary's.
 */
export async function setNote(word: SavedWord, note: string): Promise<void> {
  const text = note.trim();
  await db.words.update(word.id, { note: text || undefined });

  if (!text) return;
  await db.dict.put({
    lemma: word.lemma,
    definitions: [text],
    fetchedAt: Date.now(),
    source: 'manual',
  });
}

/** Retry a lookup that failed. Silent either way. */
export async function retryLookup(word: SavedWord): Promise<boolean> {
  const entry = await lookupDefinition(word.lemma);
  if (!entry) return false;

  await db.words.update(word.id, {
    definition: entry.definitions[0] ?? '',
    lookupFailed: undefined,
  });
  return true;
}

export async function deleteWord(id: string): Promise<void> {
  await db.words.delete(id);
}
