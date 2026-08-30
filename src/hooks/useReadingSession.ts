import { useCallback, useEffect, useRef } from 'react';
import { db } from '@/db/db';
import { flipRate } from '@/lib/flipRate';
import { newId } from '@/lib/id';

/** A session with no activity for this long is closed where it stopped. */
export const IDLE_MS = 5 * 60 * 1000;

const IDLE_CHECK_MS = 30 * 1000;

/**
 * Opens a Session when the reader mounts and closes it on unmount, after five
 * minutes of no activity, or as soon as the page is hidden.
 *
 * Both counters are sets of paragraph indices, not running totals, so
 * re-reading a paragraph does not inflate either side of the flip rate.
 */
export function useReadingSession(docId: string | undefined) {
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef(0);
  /** Whether this session has ever been written to the database. */
  const written = useRef(false);
  const viewed = useRef(new Set<number>());
  const flipped = useRef(new Set<number>());
  const lastActivity = useRef(Date.now());
  const mounted = useRef(true);

  const counts = () => {
    const v = viewed.current.size;
    const f = flipped.current.size;
    return { paragraphsViewed: v, paragraphsFlipped: f, flipRate: flipRate(v, f) };
  };

  /**
   * Write the session out, stamped with the last moment it was known alive.
   *
   * Two decisions here, both learned from rows this app actually produced.
   *
   * Nothing is written until there is something to write. A row created on
   * mount survives as permanent rubbish whenever the page goes away without
   * running cleanup, and opening a document to glance at it is not a reading
   * session.
   *
   * And `endedAt` is written on every save rather than only at the end. A
   * write started during `pagehide` or `visibilitychange` is routinely killed
   * before IndexedDB commits it, so a session closed only at the end is a
   * session that stays open forever — thirteen of them, in the database this
   * was found in. Carrying the end time forward means the row is always
   * complete: worst case it says the reading stopped at the last paragraph
   * that was actually counted, which is true.
   */
  const persist = useCallback(() => {
    const id = sessionId.current;
    if (!id || !docId) return;

    const totals = counts();
    if (totals.paragraphsViewed === 0 && totals.paragraphsFlipped === 0) return;

    written.current = true;
    void db.sessions.put({
      id,
      docId,
      startedAt: startedAt.current,
      endedAt: Date.now(),
      ...totals,
    });
  }, [docId]);

  const open = useCallback(() => {
    if (sessionId.current || !docId || !mounted.current) return;
    sessionId.current = newId();
    startedAt.current = Date.now();
    written.current = false;
    viewed.current = new Set();
    flipped.current = new Set();
  }, [docId]);

  const close = useCallback(() => {
    const id = sessionId.current;
    if (!id) return;
    sessionId.current = null;

    const totals = counts();
    // A session in which nothing was read is not a session. It was never
    // written, so there is nothing to clean up either.
    if (totals.paragraphsViewed === 0 && totals.paragraphsFlipped === 0) {
      if (written.current) void db.sessions.delete(id);
      return;
    }
    persist();
  }, [persist]);

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

  /**
   * Close on hide as well as on unmount. This is a best effort — the write may
   * not survive the page going away, which is exactly why `persist` keeps
   * `endedAt` current rather than trusting this moment to do it.
   *
   * Reopening is cheap: any activity after this starts a fresh session.
   */
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') close();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', close);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', close);
    };
  }, [close]);

  return { markViewed, markFlipped, touch };
}
