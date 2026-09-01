import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import ReviewCard from '@/components/ReviewCard';
import { db } from '@/db/db';
import type { CardMode, SavedWord } from '@/db/types';
import { usePace } from '@/context/PaceContext';
import { aheadSession, composeSession, type SessionStyle } from '@/lib/queue';
import { gradeCard, introduce } from '@/lib/review';
import { applySentence, findBetterSentence, setCardMode } from '@/lib/reroll';
import { shuffle, type Grade } from '@/lib/srs';

const muted = 'text-graphite dark:text-lamp-gph';

/** "3 September". No year: nothing here is ever due more than months out. */
function formatDue(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/**
 * The review session. The queue is drawn once and then left alone — a live
 * query would re-sort the deck under you as you graded it.
 */
export default function ReviewPage() {
  const { newPerDay } = usePace();
  /** Null until a style is chosen: the chooser is the first screen. */
  const [style, setStyle] = useState<SessionStyle | null>(null);
  /** Set when the reader asks to go on past what was actually due. */
  const [ahead, setAhead] = useState(false);
  /**
   * Bumped to redeal. `ahead` alone cannot be the trigger: going again after
   * an ahead session leaves it already true, the effect never re-runs, and the
   * page sits on a blank queue for good.
   */
  const [deal, setDeal] = useState(0);
  const [queue, setQueue] = useState<SavedWord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hinted, setHinted] = useState(false);
  /** When the current card went on screen, for the review log. */
  const shownAt = useRef(Date.now());

  const [rerollState, setRerollState] = useState<'idle' | 'searching' | 'none'>('idle');

  const docs = useLiveQuery(() => db.docs.toArray(), [], []);
  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );
  const byId = useMemo(() => new Map((docs ?? []).map((doc) => [doc.id, doc])), [docs]);

  useEffect(() => {
    if (style === null) return;
    let cancelled = false;

    void (async () => {
      const all = await db.words.toArray();
      if (cancelled) return;

      if (ahead) {
        setQueue(shuffle(aheadSession(all)));
        setIndex(0);
        shownAt.current = Date.now();
        return;
      }

      const { due, fresh } = composeSession(all, { newPerDay, now: Date.now() });

      // Stamped now, not when each card is first shown: a session abandoned
      // halfway has still spent those words out of today's allowance.
      await introduce(fresh);

      if (cancelled) return;
      // Shuffled together so a session is not review-then-new in two blocks.
      setQueue(shuffle([...due, ...fresh]));
      setIndex(0);
      shownAt.current = Date.now();
    })();

    return () => {
      cancelled = true;
    };
    // Redrawn only when a session actually starts. `newPerDay` is left out
    // deliberately: changing the daily limit mid-session must not redeal the
    // cards under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, ahead, deal]);

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
      setRevealed(false);
      setHinted(false);
      setRerollState('idle');
      setIndex((i) => i + 1);
      shownAt.current = Date.now();
    },
    [card],
  );

  /** Swap this card onto a better sentence, in place, without losing your spot. */
  const onReroll = useCallback(async () => {
    if (!card) return;
    setRerollState('searching');

    const better = await findBetterSentence(card);
    if (!better) {
      // Say so rather than doing nothing: there is no cleaner sentence in the
      // corpus yet.
      setRerollState('none');
      return;
    }

    await applySentence(card, better);
    setQueue((current) =>
      current?.map((w) =>
        w.id === card.id
          ? {
              ...w,
              sentence: better.sentence,
              charOffset: better.charOffset,
              docId: better.docId,
              paragraphIndex: better.paragraphIndex,
              sentenceScore: better.score,
              suspended: false,
            }
          : w,
      ) ?? null,
    );
    setRerollState('idle');
    setRevealed(false);
    setHinted(false);
    shownAt.current = Date.now();
  }, [card]);

  const onSetMode = useCallback(
    (mode: CardMode) => {
      if (!card) return;
      void setCardMode(card, mode);
      setQueue(
        (current) => current?.map((w) => (w.id === card.id ? { ...w, cardMode: mode } : w)) ?? null,
      );
    },
    [card],
  );

  if (style === null) return <StylePicker onPick={setStyle} />;
  if (queue === null) return <Page title="Review" />;

  if (queue.length === 0) {
    return (
      <Page title="Review">
        <p className={`type-en ${muted}`}>Nothing due.</p>
        <ReviewAhead
          onStart={() => {
            setAhead(true);
            setQueue(null);
            setDeal((n) => n + 1);
          }}
        />
      </Page>
    );
  }

  if (!card) {
    return (
      <Summary
        reviewed={queue.length}
        onAgain={() => {
          setAhead(true);
          setQueue(null);
          setDeal((n) => n + 1);
        }}
      />
    );
  }

  return (
    <Page title="Review">
      <ReviewCard
        word={card}
        docTitle={titles.get(card.docId) ?? ''}
        translation={byId.get(card.docId)?.pairs[card.paragraphIndex]?.en ?? ''}
        style={style}
        revealed={revealed}
        hinted={hinted}
        onReveal={() => setRevealed(true)}
        onHint={() => setHinted(true)}
        onGrade={onGrade}
        onSetMode={onSetMode}
        onReroll={() => void onReroll()}
        rerollState={rerollState}
      />
    </Page>
  );
}

/**
 * Which kind of question this session asks. Asked every time rather than
 * remembered: the two are different exercises.
 */
function StylePicker({ onPick }: { onPick: (style: SessionStyle) => void }) {
  const option =
    'flex min-h-16 w-full flex-col justify-center border-b border-rule py-3 text-left dark:border-lamp-gph/25';

  return (
    <Page title="Review">
      <button type="button" onClick={() => onPick('sentence')} className={option}>
        <span className="text-lg">In context</span>
        <span className={`type-en ${muted}`}>The sentence you read it in</span>
      </button>

      <button type="button" onClick={() => onPick('word')} className={option}>
        <span className="text-lg">Word only</span>
        <span className={`type-en ${muted}`}>The meaning, and you supply the German</span>
      </button>
    </Page>
  );
}

/**
 * Going on past what was due. Offered, never automatic: grading early
 * shortens the interval a card earns.
 */
function ReviewAhead({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onStart}
        className={`min-h-12 rounded-sm border border-rule px-4 dark:border-lamp-gph/25 ${muted}`}
      >
        Review ahead anyway
      </button>
      <p className={`type-en mt-3 ${muted}`}>
        Cards answered before they are due earn shorter intervals.
      </p>
    </div>
  );
}

function Summary({ reviewed, onAgain }: { reviewed: number; onAgain: () => void }) {
  const next = useLiveQuery(async () => {
    const soonest = await db.words.orderBy('dueAt').first();
    if (!soonest) return null;
    // Compared against the clock inside the query, so the answer does not
    // change on a re-render.
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

      <ReviewAhead onStart={onAgain} />
    </Page>
  );
}
