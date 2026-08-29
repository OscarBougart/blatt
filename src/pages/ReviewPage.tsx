import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import ReviewCard from '@/components/ReviewCard';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { dueWords, schedule, shuffle, type Grade } from '@/lib/srs';

/** One sitting. Long enough to be worth doing, short enough to finish. */
export const SESSION_CAP = 20;

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
  const [queue, setQueue] = useState<SavedWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

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
      setQueue(shuffle(dueWords(all, Date.now())).slice(0, SESSION_CAP));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const card = queue?.[index];

  const onGrade = useCallback(
    (grade: Grade) => {
      if (!card) return;
      const next = schedule(card, grade, Date.now());
      void db.words.update(card.id, {
        ease: next.ease,
        interval: next.interval,
        repetitions: next.repetitions,
        lapses: next.lapses,
        dueAt: next.dueAt,
      });
      setRevealed(false);
      setIndex((i) => i + 1);
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
