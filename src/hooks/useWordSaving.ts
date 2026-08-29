import { useCallback } from 'react';
import type { Doc, SavedWord } from '@/db/types';
import { locate } from '@/lib/segment';
import { useWordDoubleTap } from './useWordDoubleTap';

interface Options {
  doc: Doc | null;
  saved: Map<string, SavedWord>;
  save: (request: {
    surface: string;
    lemma: string;
    sentence: string;
    charOffset: number;
    paragraphIndex: number;
  }) => Promise<void> | void;
  remove: (key: string, id: string) => Promise<void> | void;
  touch: () => void;
  /** When a tap should be ignored because it is the tail of a swipe. */
  ignoreTap: () => boolean;
}

/**
 * Double-tap a German word to save it, double-tap a saved one to remove it.
 *
 * No sheet, no modal, no confirmation. The only feedback is the underline
 * drawing itself in, and that is the point: saving a word must not interrupt
 * reading even for a moment.
 */
export function useWordSaving({ doc, saved, save, remove, touch, ignoreTap }: Options) {
  const onDoubleTap = useCallback(
    (key: string, element: HTMLElement) => {
      if (!doc) return;
      touch();

      const existing = saved.get(key);
      if (existing) {
        void remove(key, existing.id);
        return;
      }

      const paragraphIndex = Number(element.dataset.p);
      const offset = Number(element.dataset.o);
      const surface = element.dataset.w ?? '';
      const paragraph = doc.pairs[paragraphIndex]?.de ?? '';
      const { sentence, charOffset } = locate(paragraph, offset);

      // The lemma was worked out at import; this is a map lookup, never a
      // network call. If the map has nothing, the surface form is the lemma.
      const lemma = doc.lemmaMap?.[surface]?.[0]?.lemma ?? surface;

      void save({ surface, lemma, sentence, charOffset, paragraphIndex });
    },
    [doc, saved, save, remove, touch],
  );

  return useWordDoubleTap(onDoubleTap, ignoreTap);
}
