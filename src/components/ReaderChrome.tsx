import { useEffect, useRef, useState } from 'react';
import BackArrow from '@/components/BackArrow';

/** Set once the reader has been shown the way out of a text. */
const SEEN_KEY = 'blatt:exit-seen';

/** How long the arrow lingers before fading back out of the page. */
const HOLD_MS = 3000;

/** The first visit holds it longer: nothing else on this screen says the text
 *  is not a dead end, and a newcomer is still reading the first paragraph. */
const FIRST_VISIT_MS = 8000;

/** A scroll smaller than this is a thumb settling, not a decision. */
const SCROLL_EPSILON = 4;

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // No storage. Assume it has *not* been seen: the cost of being wrong is
    // that the arrow lingers five seconds longer, weighed against a reader who
    // never finds the way out at all.
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do. The hint is cosmetic.
  }
}

interface ReaderChromeProps {
  side: 'de' | 'en';
  /** The pane currently on screen. Scrolling up here calls the arrow back. */
  pane: HTMLElement | null;
  onExit: () => void;
  onFlip: () => void;
}

/**
 * The only thing ever drawn over the reading column, and it is drawn in
 * graphite and then taken away.
 *
 * The rule is that reading happens against text and nothing else. A back arrow
 * that never leaves would break it. One that greets you, fades, and returns
 * when you scroll up — the gesture of someone looking for a way out — keeps
 * the screen bare for the reading itself, which is the part the rule is about.
 */
export default function ReaderChrome({ side, pane, onExit, onFlip }: ReaderChromeProps) {
  const [visible, setVisible] = useState(true);
  /**
   * A text short enough to fit the screen can never be scrolled up, so the
   * gesture that calls the arrow back is unavailable to it — and the arrow
   * fades regardless, leaving the undisclosed swipe as the only way out.
   * Where there is no scrolling to protect, the arrow stays.
   */
  const [scrollable, setScrollable] = useState(true);
  const first = useRef(!hasSeen());

  useEffect(() => {
    if (!pane) return;
    const measure = () => setScrollable(pane.scrollHeight > pane.clientHeight + SCROLL_EPSILON);
    measure();

    // The panes fill after mount and reflow when the type size changes, so one
    // measurement at mount is not enough.
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [pane]);

  // The opening appearance. Runs once per document, not once per flip.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setVisible(false);
        markSeen();
      },
      first.current ? FIRST_VISIT_MS : HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  // Scrolling up asks for it back. Scrolling down is reading, and reading is
  // left alone.
  useEffect(() => {
    if (!pane) return;
    let last = pane.scrollTop;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
      const top = pane.scrollTop;
      const up = top < last - SCROLL_EPSILON;
      last = top;
      if (!up) return;

      setVisible(true);
      markSeen();
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), HOLD_MS);
    };

    pane.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      pane.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [pane]);

  const shown = visible || !scrollable;

  return (
    <>
      <button
        type="button"
        onClick={onExit}
        aria-label="Back to library"
        aria-hidden={!shown}
        tabIndex={shown ? 0 : -1}
        className={[
          'absolute left-2 top-2 z-10 flex h-12 w-12 items-center justify-center',
          'text-graphite transition-opacity duration-500 dark:text-lamp-gph',
          shown ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <BackArrow />
      </button>

      {/* The keyboard and screen-reader equivalent of the flip. Off-screen
          rather than a transparent overlay: a 24px invisible button down the
          edge swallowed double-taps on the first and last word of every line. */}
      <button
        type="button"
        onClick={onFlip}
        className="sr-only focus:not-sr-only focus:absolute focus:right-2 focus:top-2 focus:z-10 focus:bg-paper focus:p-2 dark:focus:bg-lamp"
      >
        {side === 'de' ? 'Show English' : 'Show German'}
      </button>
    </>
  );
}
