import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/db/db';
import type { Doc } from '@/db/types';
import GermanParagraph from '@/components/GermanParagraph';
import { useCurrentParagraph } from '@/hooks/useCurrentParagraph';
import { useDwell } from '@/hooks/useDwell';
import { useReadingSession } from '@/hooks/useReadingSession';
import { useSavedWords } from '@/hooks/useSavedWords';
import { useSwipe } from '@/hooks/useSwipe';
import { useWordDoubleTap } from '@/hooks/useWordDoubleTap';
import { lemmatizeDocument } from '@/lib/lemma/lemmatizeDocument';
import { locate } from '@/lib/segment';

type Side = 'de' | 'en';

const SLIDE_MS = 260;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

/** Breathing room above the paragraph a flip or a restore lands on. */
const LANDING_OFFSET = 28;

function scrollToParagraph(pane: HTMLElement | null, index: number) {
  const el = pane?.querySelector<HTMLElement>(`[data-index="${index}"]`);
  if (!pane || !el) return;
  pane.scrollTop = Math.max(0, el.offsetTop - LANDING_OFFSET);
}

/**
 * Two full-screen views of one document, one language each. They are never
 * both legible: the pane that is off-screen is also inert and hidden from
 * assistive technology.
 */
export default function ReaderPage() {
  const { docId } = useParams<{ docId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [side, setSide] = useState<Side>('de');
  const [restoreTo, setRestoreTo] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [dePane, setDePane] = useState<HTMLElement | null>(null);
  const [enPane, setEnPane] = useState<HTMLElement | null>(null);
  const restored = useRef(false);
  const sideRef = useRef<Side>('de');
  const lastSwipeAt = useRef(0);

  const { saved, exiting, save, remove } = useSavedWords(docId);
  const savedKeys = useMemo(() => new Set(saved.keys()), [saved]);

  const count = doc?.pairs.length ?? 0;
  const { markViewed, markFlipped, touch } = useReadingSession(docId);

  // Each pane scrolls independently, so each needs its own observer. Only the
  // pane on screen is tracked — the other one is not being read.
  //
  // These are destructured deliberately: the hook returns a fresh object every
  // render, and an effect that depends on the object re-runs every render. An
  // effect that schedules anything would then cancel its own work in cleanup
  // before it ever ran.
  const {
    current: deCurrent,
    register: deRegister,
    setCurrent: setDeCurrent,
  } = useCurrentParagraph(count, tracking && side === 'de', dePane);
  const {
    current: enCurrent,
    register: enRegister,
    setCurrent: setEnCurrent,
  } = useCurrentParagraph(count, tracking && side === 'en', enPane);

  const current = side === 'de' ? deCurrent : enCurrent;

  // German dwell feeds the denominator, English dwell the numerator.
  useDwell(deCurrent, tracking && side === 'de', markViewed);
  useDwell(enCurrent, tracking && side === 'en', markFlipped);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    restored.current = false;
    sideRef.current = 'de';
    setTracking(false);
    setSide('de');

    void (async () => {
      const loaded = await db.docs.get(docId);
      if (cancelled) return;
      setRestoreTo(loaded?.lastParagraphIndex ?? 0);
      setDoc(loaded ?? null);

      // Documents imported before the lemma engine existed have an empty map.
      // Fill it in on first open, in the background — reading is not blocked.
      if (loaded && Object.keys(loaded.lemmaMap ?? {}).length === 0) {
        void lemmatizeDocument(loaded.pairs).then((lemmaMap) => {
          if (!cancelled) void db.docs.update(loaded.id, { lemmaMap });
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Tracking stays off until the restore scroll has landed, or the jump
  // overwrites the saved position with everything it flew past on the way.
  useEffect(() => {
    if (!doc || restoreTo === null || !dePane) return;

    // The scroll itself must happen only once. Enabling tracking must happen
    // on every run of this effect: StrictMode mounts effects twice, and a
    // guard that skipped the second run would leave the frame scheduled by the
    // first run already cancelled by its own cleanup — tracking would never
    // turn on, silently disabling the flip, the stats and position saving.
    if (!restored.current) {
      restored.current = true;
      if (restoreTo > 0) {
        scrollToParagraph(dePane, restoreTo);
        setDeCurrent(restoreTo);
      } else {
        dePane.scrollTop = 0;
      }
    }

    // One frame for the scroll to settle before the observer starts believing
    // what it sees. requestAnimationFrame never fires in a background tab, so a
    // timer backs it up — otherwise a reader mounted while hidden would never
    // start tracking at all.
    const frame = requestAnimationFrame(() => setTracking(true));
    const fallback = setTimeout(() => setTracking(true), 100);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [doc, restoreTo, dePane, setDeCurrent]);

  useEffect(() => {
    if (!docId || !tracking) return;
    void db.docs.update(docId, { lastParagraphIndex: current });
  }, [docId, current, tracking]);

  /**
   * The flip carries the paragraph index across, not the scroll offset. German
   * and English paragraphs are different heights, so pixels would land you
   * somewhere arbitrary; paragraph 12 must become paragraph 12.
   */
  const flip = useCallback(
    (to: Side) => {
      // Read the live side from a ref rather than a setState updater: an
      // updater must be pure, and React double-invokes it in development.
      const from = sideRef.current;
      if (to === from) return;

      const index = from === 'de' ? deCurrent : enCurrent;
      if (to === 'de') {
        scrollToParagraph(dePane, index);
        setDeCurrent(index);
      } else {
        scrollToParagraph(enPane, index);
        setEnCurrent(index);
      }

      sideRef.current = to;
      touch();
      setSide(to);
    },
    [deCurrent, enCurrent, dePane, enPane, setDeCurrent, setEnCurrent, touch],
  );

  const onSwipe = useCallback(
    (direction: 'left' | 'right') => {
      lastSwipeAt.current = Date.now();
      // Right-to-left drags English in from the right; left-to-right pushes
      // it back off. The gesture and the motion go the same way.
      flip(direction === 'left' ? 'en' : 'de');
    },
    [flip],
  );
  const swipe = useSwipe(onSwipe);

  /**
   * Double-tap a German word to save it, double-tap a saved one to remove it.
   *
   * No sheet, no modal, no confirmation. The only feedback is the underline
   * drawing itself in, and that is the point: saving a word must not interrupt
   * reading even for a moment.
   */
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

  // A swipe ends in a click on some browsers. Flipping the language and saving
  // a word with the same gesture would be maddening.
  const ignoreTap = useCallback(() => Date.now() - lastSwipeAt.current < 400, []);
  const onWordTap = useWordDoubleTap(onDoubleTap, ignoreTap);

  if (!doc) return null;

  const panes = [
    { key: 'de' as const, label: 'German', register: deRegister },
    { key: 'en' as const, label: 'English', register: enRegister },
  ];

  return (
    <div
      {...swipe}
      className="fixed inset-0 overflow-hidden bg-paper dark:bg-lamp"
      onScrollCapture={touch}
      onClick={onWordTap}
    >
      <div
        className="flex h-full w-[200%] will-change-transform"
        style={{
          transform: side === 'de' ? 'translateX(0)' : 'translateX(-50%)',
          transition: `transform ${SLIDE_MS}ms ${EASE}`,
        }}
      >
        {panes.map((entry) => {
          const isActive = entry.key === side;
          const isGerman = entry.key === 'de';
          return (
            <section
              key={entry.key}
              ref={isGerman ? setDePane : setEnPane}
              aria-label={entry.label}
              aria-hidden={!isActive}
              // The off-screen pane must not be reachable by keyboard, by
              // screen reader, or by find-in-page. Never both languages at once.
              {...{ inert: isActive ? undefined : '' }}
              className="relative h-full w-1/2 select-none overflow-y-auto overscroll-contain"
              // `manipulation` removes the browser's double-tap zoom, which
              // would otherwise fight the save gesture, and its 300ms click
              // delay with it. Settings carries the type-size control, because
              // this also disables pinch-zoom.
              style={{ touchAction: 'manipulation' }}
            >
              <article
                className={`mx-auto max-w-[34rem] px-7 pb-[40vh] pt-16 ${
                  isGerman
                    ? 'text-ink dark:text-lamp-ink'
                    : 'text-graphite dark:text-lamp-gph'
                }`}
              >
                {doc.pairs.map((pair, i) =>
                  isGerman ? (
                    <GermanParagraph
                      key={i}
                      text={pair.de}
                      paragraphIndex={i}
                      savedKeys={savedKeys}
                      exitingKeys={exiting}
                      innerRef={entry.register(i)}
                    />
                  ) : (
                    <p
                      key={i}
                      lang="en"
                      data-index={i}
                      ref={entry.register(i)}
                      className="type-en-read mb-7"
                    >
                      {pair.en}
                    </p>
                  ),
                )}
              </article>
            </section>
          );
        })}
      </div>

      {/* Accessibility fallback for the swipe, and the only affordance on the
          screen. Invisible, but a real button. */}
      <button
        type="button"
        onClick={() => flip(side === 'de' ? 'en' : 'de')}
        aria-label={side === 'de' ? 'Show English' : 'Show German'}
        className="absolute right-0 top-0 h-full w-6 cursor-default opacity-0"
      />
    </div>
  );
}
