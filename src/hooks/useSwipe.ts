import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { swipeDirection, type SwipeDirection } from '@/lib/swipe';

/**
 * Horizontal swipe detection that stays out of the way of vertical scrolling.
 *
 * The decision itself lives in `swipeDirection`, which is pure and unit tested.
 * This hook only turns pointer events into a dx/dy for it.
 *
 * The panes carry `touch-action: pan-y`, so the browser keeps handling vertical
 * scrolling natively and we only ever see the horizontal component.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const fired = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (!event.isPrimary) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    fired.current = false;
  }, []);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const origin = start.current;
      if (!origin || fired.current || event.pointerId !== origin.id) return;

      const direction = swipeDirection(
        event.clientX - origin.x,
        event.clientY - origin.y,
      );
      if (!direction) return;

      fired.current = true;
      onSwipe(direction);
    },
    [onSwipe],
  );

  const onPointerUp = useCallback(() => {
    start.current = null;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };
}
