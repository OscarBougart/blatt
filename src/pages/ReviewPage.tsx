import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import EmptyState from '@/components/EmptyState';
import LengthPicker from '@/components/LengthPicker';
import Page from '@/components/Page';
import ReviewCard from '@/components/ReviewCard';
import ReviewSummary from '@/components/ReviewSummary';
import StylePicker from '@/components/StylePicker';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { usePace } from '@/context/PaceContext';
import { useFocusMode } from '@/hooks/useFocusMode';
import { reviewSession, type SessionStyle } from '@/lib/queue';
import { gradeCard, introduce } from '@/lib/review';
import { shuffle, type Grade } from '@/lib/srs';

const muted = 'text-graphite dark:text-lamp-gph';

/** A fresh scoreline. Frozen so it can be reused as the reset value. */
const EMPTY_TALLY: Record<Grade, number> = Object.freeze({
  hard: 0,
  medium: 0,
  good: 0,
  easy: 0,
});

/**
 * The review session. The queue is drawn once and then left alone — a live
 * query would re-sort the deck under you as you graded it.
 */
export default function ReviewPage() {
  const { newPerDay } = usePace();
  /**
   * Both questions are asked every time, style first: nothing about a round
   * is carried over from the last one. Answering the second one is what
   * starts the round, so a round is running exactly when both are set.
   */
  const [style, setStyle] = useState<SessionStyle | null>(null);
  const [limit, setLimit] = useState<number | null>(null);
  const started = style !== null && limit !== null;
  // A running round, summary included, has the screen to itself: no tab bar.
  useFocusMode(started);
  /** How each card was graded this round, for the summary. */
  const [tally, setTally] = useState<Record<Grade, number>>(EMPTY_TALLY);
  /** Bumped to redeal after a deal that failed. */
  const [deal, setDeal] = useState(0);
  const [queue, setQueue] = useState<SavedWord[] | null>(null);
  /**
   * How many words are saved at all. An empty queue means two different
   * things — nothing saved, or nothing due — and they want different advice.
   */
  const [saved, setSaved] = useState(0);
  /** The deal failed. Without this the screen waits on a queue that never comes. */
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hinted, setHinted] = useState(false);
  /** When the current card went on screen, for the review log. */
  const shownAt = useRef(Date.now());

  const docs = useLiveQuery(() => db.docs.toArray(), [], []);
  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  useEffect(() => {
    if (style === null || limit === null) return;
    let cancelled = false;
    setFailed(false);

    void (async () => {
      const all = await db.words.toArray();
      if (cancelled) return;
      setSaved(all.length);

      const { cards, fresh } = reviewSession(all, { limit, newPerDay, now: Date.now() });

      // Stamped now, not when each card is first shown: a round abandoned
      // halfway has still spent those words out of today's allowance.
      await introduce(fresh);

      if (cancelled) return;
      // Shuffled together so a round is not review-then-new in two blocks.
      setQueue(shuffle([...cards, ...fresh]));
      setIndex(0);
      shownAt.current = Date.now();
    })().catch(() => {
      // Dexie can refuse outright — a blocked upgrade, storage evicted under
      // us. Leaving `queue` null silently renders a blank page with no back
      // arrow and no way to retry, which is worse than saying so.
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
    // Redrawn only when a session actually starts. `newPerDay` is left out
    // deliberately: changing the daily limit mid-session must not redeal the
    // cards under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, limit, deal]);

  const card = queue?.[index];

  // A long sentence leaves the page scrolled down. Without this the next card
  // opens halfway through itself, with the question above the fold.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [index]);

  const onGrade = useCallback(
    (grade: Grade) => {
      if (!card) return;
      void gradeCard(card, grade, Date.now() - shownAt.current);
      setTally((current) => ({ ...current, [grade]: current[grade] + 1 }));
      setRevealed(false);
      setHinted(false);
      setIndex((i) => i + 1);
      shownAt.current = Date.now();
    },
    [card],
  );

  /** Leave the round, back to where a review begins: the style picker. */
  const stop = () => {
    setStyle(null);
    setLimit(null);
    setQueue(null);
    setTally(EMPTY_TALLY);
    setIndex(0);
    setRevealed(false);
    setHinted(false);
  };

  if (style === null) return <StylePicker onPick={setStyle} />;
  if (limit === null) return <LengthPicker onPick={setLimit} onBack={() => setStyle(null)} />;

  if (failed) {
    return (
      <Page title="Review" back={stop}>
        <EmptyState action="Try again" onAction={() => setDeal((n) => n + 1)}>
          The cards could not be dealt.
        </EmptyState>
      </Page>
    );
  }

  if (queue === null) return <Page title="Review" back={stop} />;

  if (queue.length === 0) {
    // Nothing due is not the same as nothing saved, and a reader who has been
    // saving words all week deserves to be told which of the two this is.
    return (
      <Page title="Review" back={stop}>
        {saved === 0 ? (
          <EmptyState to="/" action="Find something to read">
            No words saved yet. Double-tap a word while reading.
          </EmptyState>
        ) : (
          <EmptyState to="/words" action="See your words">
            Nothing due right now. Come back later, or read something new.
          </EmptyState>
        )}
      </Page>
    );
  }

  if (!card) {
    return (
      <ReviewSummary tally={tally} onDone={stop} />
    );
  }

  return (
    <Page
      title="Review"
      hideTitle
      back={stop}
      aside={
        <span className={`type-en ${muted}`}>
          {index + 1} / {queue.length}
        </span>
      }
    >
      {/* Centred in what is left of the screen rather than pinned to the top
          of it: a short card used to sit under the counter with the rest of
          the page empty beneath it. A long sentence grows past this, which is
          why it is a minimum and not a height. The extra room once revealed is
          for the grade bar, which is fixed and so takes no space of its own. */}
      <div
        className={`flex min-h-[calc(100dvh-14rem)] flex-col justify-center ${
          revealed ? 'pb-16' : ''
        }`}
      >
        <ReviewCard
          word={card}
          docTitle={titles.get(card.docId) ?? ''}
          style={style}
          revealed={revealed}
          hinted={hinted}
          onReveal={() => setRevealed(true)}
          onHint={() => setHinted(true)}
          onGrade={onGrade}
        />
      </div>
    </Page>
  );
}
