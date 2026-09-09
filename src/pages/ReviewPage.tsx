import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import ReviewCard from '@/components/ReviewCard';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { usePace } from '@/context/PaceContext';
import { reviewSession, type SessionStyle } from '@/lib/queue';
import { gradeCard, introduce } from '@/lib/review';
import { GRADES, GRADE_LABEL, shuffle, type Grade } from '@/lib/srs';

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
  /** Null until a style is chosen: the chooser is the first screen. */
  const [style, setStyle] = useState<SessionStyle | null>(null);
  /** How many cards this round runs for. Null until the reader picks. */
  const [limit, setLimit] = useState<number | null>(null);
  /** How each card was graded this round, for the summary. */
  const [tally, setTally] = useState<Record<Grade, number>>(EMPTY_TALLY);
  /** Bumped to redeal: asking for another round of the same length. */
  const [deal, setDeal] = useState(0);
  const [queue, setQueue] = useState<SavedWord[] | null>(null);
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

    void (async () => {
      const all = await db.words.toArray();
      if (cancelled) return;

      const { cards, fresh } = reviewSession(all, { limit, newPerDay, now: Date.now() });

      // Stamped now, not when each card is first shown: a round abandoned
      // halfway has still spent those words out of today's allowance.
      await introduce(fresh);

      if (cancelled) return;
      // Shuffled together so a round is not review-then-new in two blocks.
      setQueue(shuffle([...cards, ...fresh]));
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

  /** Deal another round. */
  const again = () => {
    setQueue(null);
    setTally(EMPTY_TALLY);
    setIndex(0);
    setDeal((n) => n + 1);
  };

  /** Back to the length question, keeping the style. */
  const pickAgain = () => {
    setLimit(null);
    setQueue(null);
    setTally(EMPTY_TALLY);
    setIndex(0);
  };

  if (style === null) return <StylePicker onPick={setStyle} />;
  if (limit === null) return <LengthPicker onPick={setLimit} onBack={() => setStyle(null)} />;
  if (queue === null) return <Page title="Review" />;

  if (queue.length === 0) {
    return (
      <Page title="Review" back={() => setLimit(null)}>
        <p className={`type-en ${muted}`}>No words saved yet. Tap one while reading.</p>
      </Page>
    );
  }

  if (!card) {
    return (
      <Summary tally={tally} onAgain={again} onChangeLength={pickAgain} />
    );
  }

  return (
    <Page
      title="Review"
      hideTitle
      back={pickAgain}
      aside={
        <span className={`type-en ${muted}`}>
          {index + 1} / {queue.length}
        </span>
      }
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

/** How long this round runs. Short by default: a round you finish is a round. */
function LengthPicker({ onPick, onBack }: { onPick: (limit: number) => void; onBack: () => void }) {
  return (
    <Page title="Review" back={onBack}>
      <p className={`type-en mb-4 ${muted}`}>How many cards?</p>
      <div className="flex gap-3">
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={`min-h-12 flex-1 rounded-sm border border-rule text-lg dark:border-lamp-gph/25`}
          >
            {n}
          </button>
        ))}
      </div>
    </Page>
  );
}

/**
 * How the round went, as the four grades. Not a score: a card graded Hard is
 * a card you will see again sooner, not a mark against the reader.
 */
function Summary({
  tally,
  onAgain,
  onChangeLength,
}: {
  tally: Record<Grade, number>;
  onAgain: () => void;
  onChangeLength: () => void;
}) {
  return (
    <Page title="Review" back={onChangeLength}>
      <dl className="type-en">
        {GRADES.map((grade) => (
          <div key={grade} className="flex items-baseline justify-between py-1">
            <dt>{GRADE_LABEL[grade]}</dt>
            <dd className={tally[grade] === 0 ? muted : undefined}>{tally[grade]}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onAgain}
          className={`min-h-12 rounded-sm border border-rule px-4 dark:border-lamp-gph/25 ${muted}`}
        >
          Another round
        </button>
        <button
          type="button"
          onClick={onChangeLength}
          className={`type-en min-h-12 underline underline-offset-4 ${muted}`}
        >
          Change length
        </button>
      </div>
    </Page>
  );
}
