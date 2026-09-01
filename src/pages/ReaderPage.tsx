import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/db';
import type { Doc } from '@/db/types';
import ReaderPane from '@/components/ReaderPane';
import { useCurrentParagraph } from '@/hooks/useCurrentParagraph';
import { useDwell } from '@/hooks/useDwell';
import { useReadingSession } from '@/hooks/useReadingSession';
import { useSavedWords } from '@/hooks/useSavedWords';
import { useSwipe } from '@/hooks/useSwipe';
import { useFlipHint, HINT_SHIFT } from '@/hooks/useFlipHint';
import { useWordSaving } from '@/hooks/useWordSaving';
import { lemmatizeDocument } from '@/lib/lemma/lemmatizeDocument';
import { lemmasOf, recordSightings } from '@/lib/sightings';
import { positionOf, scrollTopFor } from '@/lib/readingPosition';

type Side = 'de' | 'en';

const SLIDE_MS = 260;
const HINT_MS = 520;
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
  const navigate = useNavigate();
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

  // Each pane scrolls independently, so each gets its own tracker; only the
  // one on screen is live. Destructured deliberately — the hook returns a
  // fresh object every render, and an effect depending on that object would
  // cancel its own scheduled work in cleanup before it ran.
  const {
    current: deCurrent,
    register: deRegister,
    setCurrent: setDeCurrent,
    measure: measureDe,
  } = useCurrentParagraph(count, tracking && side === 'de', dePane);
  const {
    current: enCurrent,
    register: enRegister,
    setCurrent: setEnCurrent,
    measure: measureEn,
  } = useCurrentParagraph(count, tracking && side === 'en', enPane);

  const current = side === 'de' ? deCurrent : enCurrent;

  /**
   * A German paragraph that met the dwell threshold, counted twice: once for
   * the flip rate, once for the familiarity model. Fired and forgotten — this
   * runs constantly and must never make the page wait.
   */
  const onGermanDwell = useCallback(
    (index: number) => {
      markViewed(index);
      const paragraph = doc?.pairs[index]?.de;
      if (paragraph) void recordSightings(lemmasOf(paragraph, doc.lemmaMap), Date.now());
    },
    [markViewed, doc],
  );

  // German dwell feeds the denominator, English dwell the numerator.
  useDwell(deCurrent, tracking && side === 'de', onGermanDwell);
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

    // Scroll once, but enable tracking on every run. StrictMode mounts twice,
    // and a guard that skipped the second run would leave the first run's
    // frame already cancelled by its own cleanup — tracking would then never
    // turn on, silently killing the flip, the stats and position saving.
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

  // Nothing on this screen can advertise the flip, so the page demonstrates it
  // once, on a first visit, and then never again.
  const { hinting, seen } = useFlipHint(tracking);

  /**
   * The flip carries the reading position, not the scroll offset: paragraphs
   * differ in height between the two languages, so pixels land arbitrarily.
   * The fraction matters too — a paragraph here can be several screens tall.
   */
  const flip = useCallback(
    (to: Side) => {
      // Read the live side from a ref rather than a setState updater: an
      // updater must be pure, and React double-invokes it in development.
      const from = sideRef.current;
      if (to === from) return;

      // Measured here rather than read from a ref: the scroll listener updates
      // on an animation frame, which does not run while the page is hidden.
      const fromPane = from === 'de' ? dePane : enPane;
      const position = fromPane
        ? positionOf(
            from === 'de' ? measureDe() : measureEn(),
            fromPane.scrollTop,
            fromPane.clientHeight,
          )
        : { index: 0, fraction: 0 };

      const pane = to === 'de' ? dePane : enPane;
      if (pane) {
        pane.scrollTop = scrollTopFor(
          to === 'de' ? measureDe() : measureEn(),
          position,
          LANDING_OFFSET,
        );
      }

      if (to === 'de') setDeCurrent(position.index);
      else setEnCurrent(position.index);

      sideRef.current = to;
      if (to === 'en') seen();
      touch();
      setSide(to);
    },
    [
      dePane,
      enPane,
      measureDe,
      measureEn,
      setDeCurrent,
      setEnCurrent,
      touch,
      seen,
    ],
  );

  /**
   * Swipe right to go back, a step at a time: English → German → library.
   * That last step is the only way out of the reader — there is no chrome on
   * this screen and, installed as a PWA, no browser back button either.
   */
  const onSwipe = useCallback(
    (direction: 'left' | 'right') => {
      lastSwipeAt.current = Date.now();

      // Right-to-left drags English in from the right. Gesture and motion
      // travel the same way.
      if (direction === 'left') {
        flip('en');
        return;
      }

      if (sideRef.current === 'en') {
        flip('de');
        return;
      }

      void navigate('/');
    },
    [flip, navigate],
  );
  const swipe = useSwipe(onSwipe);

  // Some browsers end a swipe with a click; without this, one gesture both
  // flips the language and saves a word.
  const ignoreTap = useCallback(() => Date.now() - lastSwipeAt.current < 400, []);
  const onWordTap = useWordSaving({ doc, saved, save, remove, touch, ignoreTap });

  if (!doc) return null;

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
          transform:
            side === 'en'
              ? 'translateX(-50%)'
              : hinting
                ? `translateX(${HINT_SHIFT})`
                : 'translateX(0)',
          // The hint moves more slowly than a flip: it is being shown to you,
          // not performed by you.
          transition: `transform ${hinting ? HINT_MS : SLIDE_MS}ms ${EASE}`,
        }}
      >
        <ReaderPane
          language="de"
          pairs={doc.pairs}
          active={side === 'de'}
          paneRef={setDePane}
          register={deRegister}
          savedKeys={savedKeys}
          exitingKeys={exiting}
        />
        <ReaderPane
          language="en"
          pairs={doc.pairs}
          active={side === 'en'}
          paneRef={setEnPane}
          register={enRegister}
          savedKeys={savedKeys}
          exitingKeys={exiting}
        />
      </div>

      {/* Keyboard and screen-reader equivalents for the two swipes. Off-screen
          rather than transparent overlays: a 24px invisible button down each
          edge swallowed double-taps on the first and last word of every line,
          and a stray thumb on the left edge left the document entirely. */}
      <button
        type="button"
        onClick={() => void navigate('/')}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-paper focus:p-2 dark:focus:bg-lamp"
      >
        Back to library
      </button>
      <button
        type="button"
        onClick={() => flip(side === 'de' ? 'en' : 'de')}
        className="sr-only focus:not-sr-only focus:absolute focus:right-2 focus:top-2 focus:z-10 focus:bg-paper focus:p-2 dark:focus:bg-lamp"
      >
        {side === 'de' ? 'Show English' : 'Show German'}
      </button>
    </div>
  );
}
