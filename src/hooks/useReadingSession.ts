import { useCallback, useEffect, useRef } from 'react';
import { db } from '@/db/db';
import { flipRate } from '@/lib/flipRate';
import { newId } from '@/lib/id';

/** A session with no activity for this long is closed where it stopped. */
export const IDLE_MS = 5 * 60 * 1000;

const IDLE_CHECK_MS = 30 * 1000;

/**
 * Opens a Session when the reader mounts and closes it on unmount, or after
 * five minutes of no activity.
 *
 * Both counters are sets of paragraph indices, not running totals, so
 * re-reading a paragraph does not inflate either side of the flip rate. The
 * rate is stored on every change and is deliberately not displayed anywhere
 * yet.
 */
export function useReadingSession(docId: string | undefined) {
  const sessionId = useRef<string | null>(null);
  const viewed = useRef(new Set<number>());
  const flipped = useRef(new Set<number>());
  const lastActivity = useRef(Date.now());
  const mounted = useRef(true);

  const counts = () => {
    const v = viewed.current.size;
    const f = flipped.current.size;
    return { paragraphsViewed: v, paragraphsFlipped: f, flipRate: flipRate(v, f) };
  };

  const persist = useCallback(() => {
    const id = sessionId.current;
    if (id) void db.sessions.update(id, counts());
  }, []);

  const open = useCallback(() => {
    if (sessionId.current || !docId || !mounted.current) return;
    const id = newId();
    sessionId.current = id;
    viewed.current = new Set();
    flipped.current = new Set();
    void db.sessions.add({
      id,
      docId,
      startedAt: Date.now(),
      paragraphsViewed: 0,
      paragraphsFlipped: 0,
      flipRate: 0,
    });
  }, [docId]);

  const close = useCallback(() => {
    const id = sessionId.current;
    if (!id) return;
    sessionId.current = null;

    const totals = counts();
    // A session in which nothing was read is not a session. Opening a document
    // and immediately leaving would otherwise leave a zero row that drags the
    // flip rate around, and StrictMode's double-mount creates one every time.
    if (totals.paragraphsViewed === 0 && totals.paragraphsFlipped === 0) {
      void db.sessions.delete(id);
      return;
    }
    void db.sessions.update(id, { ...totals, endedAt: Date.now() });
  }, []);

  /** Any sign of life. Reopens a session that idled out. */
  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    open();
  }, [open]);

  const markViewed = useCallback(
    (index: number) => {
      touch();
      if (viewed.current.has(index)) return;
      viewed.current.add(index);
      persist();
    },
    [touch, persist],
  );

  const markFlipped = useCallback(
    (index: number) => {
      touch();
      if (flipped.current.has(index)) return;
      flipped.current.add(index);
      persist();
    },
    [touch, persist],
  );

  useEffect(() => {
    mounted.current = true;
    open();
    return () => {
      mounted.current = false;
      close();
    };
  }, [open, close]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_MS) close();
    }, IDLE_CHECK_MS);
    return () => clearInterval(timer);
  }, [close]);

  // A backgrounded phone may never run anything again, so flush on hide.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [persist]);

  return { markViewed, markFlipped, touch };
}
