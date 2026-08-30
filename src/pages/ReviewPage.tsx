import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import ReviewCard from '@/components/ReviewCard';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { usePace } from '@/context/PaceContext';
import { composeSession } from '@/lib/queue';
import { gradeCard, introduce } from '@/lib/review';
import { shuffle, type Grade } from '@/lib/srs';

const muted = 'text-graphite dark:text-lamp-gph';

/** "3 September". No year: nothing here is ever due more than months out. */
function formatDue(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/**
 * The review session.
 *
 * The queue is drawn once, on mount, and then left alone. A live query would
 * re-sort the deck underneath you as you graded it — cards would vanish
 * mid-session and the count would move while you were reading it.
 */
export default function ReviewPage() {
  const { newPerDay } = usePace();
  const [queue, setQueue] = useState<SavedWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  /** When the current card went on screen, for the review log. */
  const shownAt = useRef(Date.now());

  const docs = useLiveQuery(() => db.docs.toArray(), [], []);
  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await db.words.toArray();
      if (cancelled) return;

      const { due, fresh } = composeSession(all, { newPerDay, now: Date.now() });

      // Stamped now, not when they are first shown. A session interrupted
      // halfway has still spent those words out of today's allowance — the
      // limit exists to pace what enters the deck, and re-offering them later
      // the same day would quietly defeat it.
      await introduce(fresh);

      if (cancelled) return;
      // Shuffled together so a session is not review-then-new in two blocks.
      setQueue(shuffle([...due, ...fresh]));
      shownAt.current = Date.now();
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only: the deck is drawn once. Changing the daily
    // limit mid-session must not redeal the cards under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = queue?.[index];

  const onGrade = useCallback(
    (grade: Grade) => {
      if (!card) return;
      void gradeCard(card, grade, Date.now() - shownAt.current);
      setRevealed(false);
      setIndex((i) => i + 1);
      shownAt.current = Date.now();
    },
    [card],
  );

  if (queue === null) return <Page title="Review" />;

  if (queue.length === 0) {
    return (
      <Page title="Review">
        <p className={`type-en ${muted}`}>Nothing due.</p>
      </Page>
    );
  }

  if (!card) return <Summary reviewed={queue.length} />;

  return (
    <Page title="Review">
      <ReviewCard
        word={card}
        docTitle={titles.get(card.docId) ?? ''}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onGrade={onGrade}
      />
    </Page>
  );
}

/**
 * What happened, and when to come back. No score, no streak, no praise — the
 * work was the point, and a number that rewards you for it would start
 * competing with the reading.
 */
function Summary({ reviewed }: { reviewed: number }) {
  const next = useLiveQuery(async () => {
    const soonest = await db.words.orderBy('dueAt').first();
    if (!soonest) return null;
    // Compared against the clock here, inside the query, rather than during
    // render: the answer must not change just because React re-rendered.
    return { at: soonest.dueAt, overdue: soonest.dueAt <= Date.now() };
  }, []);

  return (
    <Page title="Review">
      <p className="type-en">
        {reviewed} {reviewed === 1 ? 'card' : 'cards'} reviewed.
      </p>
      {next && (
        <p className={`type-en mt-2 ${muted}`}>
          {next.overdue ? 'More due now.' : `Next due ${formatDue(next.at)}.`}
        </p>
      )}
    </Page>
  );
}
