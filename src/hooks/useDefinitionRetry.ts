import { useEffect } from 'react';
import { db } from '@/db/db';
import { lookupDefinition } from '@/lib/dict';

/**
 * Retry definitions that failed to fetch, once, when connectivity returns.
 *
 * A word whose lookup failed is saved anyway, with an empty definition and
 * `lookupFailed: true`. Reading is never blocked on the dictionary, so this is
 * the only place the gap gets closed — quietly, in the background, with no
 * notice to the reader either way.
 */
export function useDefinitionRetry() {
  useEffect(() => {
    let running = false;

    async function retry() {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        const pending = await db.words.filter((w) => w.lookupFailed === true).toArray();
        for (const word of pending) {
          const entry = await lookupDefinition(word.lemma);
          if (!entry) continue; // still failing; leave the flag for next time
          await db.words.update(word.id, {
            definition: entry.definitions[0] ?? '',
            lookupFailed: undefined,
          });
        }
      } finally {
        running = false;
      }
    }

    void retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);
}
