import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { HOLD_MS, movedTooFar, type WordRect } from '@/lib/bubble';

/** A tap this soon after a hold or a dismissal belongs to that, not to the text. */
const SWALLOW_MS = 400;

export interface HeldWord {
  key: string;
  surface: string;
  rect: WordRect;
}

/** The word's first line box: a hyphenated word can wrap across two. */
function rectOf(element: HTMLElement): WordRect {
  const box = element.getClientRects()[0] ?? element.getBoundingClientRect();
  return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
}

/**
 * Press and hold a German word to see its definition.
 *
 * Built on pointer events alone, so a finger, a stylus and a mouse all behave
 * the same on every phone. The handlers are capture-phase so they sit beside
 * the swipe's own and never replace them.
 *
 * The phone's own long-press is the thing to beat. Android fires a context
 * menu, iOS a callout; both are refused here and in the pane's CSS. A press
 * that drifts is a scroll, and the browser cancelling the pointer for that
 * scroll cancels the hold with it.
 */
export function useWordHold(side: 'de' | 'en') {
  const [held, setHeld] = useState<HeldWord | null>(null);
  /** Bumped on every open, for the tutorial to notice. */
  const [opened, setOpened] = useState(0);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const press = useRef<{ x: number; y: number; id: number; fired: boolean } | null>(null);
  /** The pointer whose eventual click must not reach the double-tap. */
  const swallowPointer = useRef<number | null>(null);
  const swallowUntil = useRef(0);

  const close = useCallback(() => setHeld(null), []);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const onPointerDownCapture = useCallback(
    (event: ReactPointerEvent) => {
      if (!event.isPrimary) return;
      cancel();
      const element = (event.target as HTMLElement)?.closest?.<HTMLElement>('[data-key]');
      if (!element) {
        press.current = null;
        return;
      }

      press.current = { x: event.clientX, y: event.clientY, id: event.pointerId, fired: false };
      timer.current = setTimeout(() => {
        if (!press.current) return;
        press.current.fired = true;
        swallowPointer.current = press.current.id;
        setHeld({ key: element.dataset.key!, surface: element.dataset.w ?? '', rect: rectOf(element) });
        setOpened((n) => n + 1);
        try {
          navigator.vibrate?.(8); // Android only; iOS has no web haptics.
        } catch {
          // Refused. The bubble is feedback enough.
        }
      }, HOLD_MS);
    },
    [cancel],
  );

  const onPointerMoveCapture = useCallback(
    (event: ReactPointerEvent) => {
      const origin = press.current;
      if (!origin || origin.fired || event.pointerId !== origin.id) return;
      if (movedTooFar(event.clientX - origin.x, event.clientY - origin.y)) {
        cancel();
        press.current = null;
      }
    },
    [cancel],
  );

  const onPointerEndCapture = useCallback(
    (event: ReactPointerEvent) => {
      cancel();
      press.current = null;
      if (swallowPointer.current === event.pointerId) {
        swallowPointer.current = null;
        swallowUntil.current = Date.now() + SWALLOW_MS;
      }
    },
    [cancel],
  );

  /** Android's long-press menu, which would otherwise arrive with the bubble. */
  const onContextMenu = useCallback((event: ReactMouseEvent) => {
    if ((event.target as HTMLElement)?.closest?.('[data-key]')) event.preventDefault();
  }, []);

  /** For the double-tap: was this click the end of a hold or a dismissal? */
  const consumeTap = useCallback(() => Date.now() < swallowUntil.current, []);

  // Open, the bubble closes on a press anywhere outside it, and on scrolling.
  // That press is spent on closing: it must not also count towards a save.
  useEffect(() => {
    if (!held) return;
    const onDown = (event: PointerEvent) => {
      if (bubbleRef.current?.contains(event.target as Node)) return;
      swallowPointer.current = event.pointerId;
      setHeld(null);
    };
    const onScroll = () => setHeld(null);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [held]);

  // A flip takes the word off screen; its bubble goes with it.
  useEffect(() => close(), [side, close]);

  useEffect(() => cancel, [cancel]);

  return {
    held,
    opened,
    bubbleRef,
    close,
    consumeTap,
    handlers: {
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture: onPointerEndCapture,
      onPointerCancelCapture: onPointerEndCapture,
      onContextMenu,
    },
  };
}
