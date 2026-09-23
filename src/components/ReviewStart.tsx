import { useLiveQuery } from 'dexie-react-hooks';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { reviewSession, type SessionStyle } from '@/lib/queue';
import { STYLE_LABEL } from '@/lib/reviewPrefs';

const muted = 'text-graphite dark:text-lamp-gph';

export interface ReviewStartProps {
  style: SessionStyle;
  limit: number;
  newPerDay: number;
  onStart: () => void;
  onChange: () => void;
}

/**
 * Where a review now begins.
 *
 * The style and the length are answered from last time, so the only decision
 * left is whether to start — one tap where there used to be three. The deck
 * size is computed with the same `reviewSession` that deals the round, so the
 * number shown is the number of cards that arrive.
 */
export default function ReviewStart({
  style,
  limit,
  newPerDay,
  onStart,
  onChange,
}: ReviewStartProps) {
  const deck = useLiveQuery(
    async () => {
      const all = await db.words.toArray();
      const { cards, fresh } = reviewSession(all, { limit, newPerDay, now: Date.now() });
      return { size: cards.length + fresh.length, saved: all.length };
    },
    [limit, newPerDay],
    null,
  );

  const summary = `${STYLE_LABEL[style]} · rounds of ${limit}`;

  return (
    <Page title="Review">
      {deck !== null && deck.size === 0 ? (
        deck.saved === 0 ? (
          <EmptyState to="/" action="Find something to read">
            No words saved yet. Double-tap a word while reading.
          </EmptyState>
        ) : (
          <EmptyState to="/words" action="See your words">
            Nothing due right now. Come back later, or read something new.
          </EmptyState>
        )
      ) : (
        <>
          {/* Held blank rather than guessed at, so the number never changes
              under the reader between arriving and reading it. */}
          <p className="text-2xl">
            {deck === null ? ' ' : `${deck.size} ${deck.size === 1 ? 'card' : 'cards'} ready`}
          </p>

          <p className={`type-en mt-2 ${muted}`}>{summary}</p>

          <button
            type="button"
            onClick={onStart}
            disabled={deck === null}
            className="mt-8 flex min-h-14 w-full items-center justify-center rounded-sm border border-ink text-lg transition-colors active:bg-ink/5 disabled:opacity-40 dark:border-lamp-ink dark:active:bg-lamp-ink/10"
          >
            Start
          </button>

          <button
            type="button"
            onClick={onChange}
            className={`type-en mt-4 min-h-12 underline underline-offset-4 ${muted}`}
          >
            Change
          </button>
        </>
      )}
    </Page>
  );
}
