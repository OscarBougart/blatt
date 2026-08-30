import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { lookupDefinition } from '@/lib/dict';
import { buildFamiliarity } from '@/lib/familiarity';
import { newId } from '@/lib/id';
import { resolverFor, scoreSentence } from '@/lib/sentencePick';

/** Matches the underline animation, so the row outlives the wipe-out. */
export const MARK_MS = 160;

/**
 * Identify one saved occurrence in the text.
 *
 * A word can appear many times in a paragraph, and only the tapped occurrence
 * is marked, so the key has to pin down the exact one: paragraph, sentence,
 * and offset within that sentence.
 */
export function wordKey(paragraphIndex: number, sentence: string, charOffset: number) {
  return `${paragraphIndex}:${charOffset}:${sentence}`;
}

export interface SaveRequest {
  surface: string;
  lemma: string;
  sentence: string;
  charOffset: number;
  paragraphIndex: number;
}

export function useSavedWords(docId: string | undefined) {
  const words = useLiveQuery(
    () => (docId ? db.words.where('docId').equals(docId).toArray() : []),
    [docId],
    [] as SavedWord[],
  );

  // Words mid-wipe. They are gone from the reader's point of view but still in
  // the database until the animation finishes.
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  const saved = new Map<string, SavedWord>();
  for (const word of words ?? []) {
    saved.set(wordKey(word.paragraphIndex, word.sentence, word.charOffset), word);
  }

  const save = useCallback(
    async (request: SaveRequest) => {
      if (!docId) return;

      const word: SavedWord = {
        id: newId(),
        surface: request.surface,
        lemma: request.lemma,
        definition: '',
        sentence: request.sentence,
        charOffset: request.charOffset,
        docId,
        paragraphIndex: request.paragraphIndex,
        createdAt: Date.now(),
        // Recognition until the reader asks otherwise. This is a reading app.
        cardMode: 'recognition',
        // SM-2 starting state
        ease: 2.5,
        interval: 0,
        repetitions: 0,
        dueAt: Date.now(),
        lapses: 0,
      };

      // The save does not wait on the network. The mark appears now.
      await db.words.add(word);

      /**
       * Score the sentence the word was actually met in.
       *
       * It stays the card's sentence — it is the one you were reading, and
       * that context is worth more than a cleaner sentence you have never
       * seen. The score is recorded so that "another sentence" later knows
       * what it has to beat, and so a card can say how far it is from i+1.
       *
       * Off the save path deliberately: this reads four tables, and the
       * underline has already been drawn.
       */
      void (async () => {
        const [doc, words, sightings, logs] = await Promise.all([
          db.docs.get(docId),
          db.words.toArray(),
          db.sightings.toArray(),
          db.reviews.toArray(),
        ]);
        if (!doc) return;

        const score = scoreSentence(request.sentence, request.lemma, {
          lemmaOf: resolverFor(doc),
          isFamiliar: buildFamiliarity({ words, sightings, logs }, Date.now()),
        });
        await db.words.update(word.id, { sentenceScore: score });
      })();

      // Almost always a cache hit after import prefetch; a miss is silent.
      void lookupDefinition(request.lemma).then((entry) => {
        if (entry) {
          // An entry with no definitions is a real answer: Wiktionary has the
          // page but nothing useful on it. That is not a failure to retry.
          void db.words.update(word.id, { definition: entry.definitions[0] ?? '' });
        } else {
          void db.words.update(word.id, { lookupFailed: true });
        }
      });
    },
    [docId],
  );

  const remove = useCallback(async (key: string, id: string) => {
    setExiting((previous) => new Set(previous).add(key));
    // Let the underline wipe out before the row disappears underneath it.
    await new Promise((resolve) => setTimeout(resolve, MARK_MS));
    await db.words.delete(id);
    setExiting((previous) => {
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  }, []);

  return { saved, exiting, save, remove };
}
