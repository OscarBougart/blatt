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
 * The review session.
 *
 * The queue is drawn once, on mount, and then left alone. A live query would
 * re-sort the deck underneath you as you graded it — cards would vanish
 * mid-session and the count would move while you were reading it.
 */
export default function ReviewPage() {
  const { newPerDay } = usePace();
  /** Null until a style is chosen: the chooser is the first screen. */
  const [style, setStyle] = useState<SessionStyle | null>(null);
  /** Set when the reader asks to go on past what was actually due. */
  const [ahead, setAhead] = useState(false);
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

      // Stamped now, not when they are first shown. A session interrupted
      // halfway has still spent those words out of today's allowance — the
      // limit exists to pace what enters the deck, and re-offering them later
      // the same day would quietly defeat it.
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
  }, [style, ahead]);

  const card = queue?.[index];

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
      // Said plainly rather than silently doing nothing. The corpus simply
      // does not contain a cleaner sentence for this word yet — reading more
      // is what changes that.
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
        <ReviewAhead onStart={() => setAhead(true)} />
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
 * What happened, and when to come back. No score, no streak, no praise — the
 * work was the point, and a number that rewards you for it would start
 * competing with the reading.
 */
/**
 * Which kind of question this session asks.
 *
 * Asked every time rather than remembered. The two are different exercises —
 * one reads, one recalls — and which you want depends on the ten minutes you
 * are about to spend, not on what you picked last week.
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
 * Going on past what was due.
 *
 * Offered, never automatic. Grading a card early shortens the interval it
 * earns, so this is a real cost and the reader should be the one to accept it.
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

      <ReviewAhead onStart={onAgain} />
    </Page>
  );
}
