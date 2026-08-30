import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import FlipPlot from '@/components/FlipPlot';
import Page from '@/components/Page';
import { db } from '@/db/db';
import type { ReviewLog, Session } from '@/db/types';
import {
  duration,
  formatDuration,
  formatRate,
  formatSeconds,
  interpret,
  medianDuration,
  readableSessions,
  reviewsPerDay,
} from '@/lib/stats';

const muted = 'text-graphite dark:text-lamp-gph';

/**
 * Two diagnostics from the review log, deliberately minor.
 *
 * Small, graphite, below the flip rate and after it — the reading statistic is
 * the headline and these are footnotes to it. The strip is there so the pile
 * can be seen coming rather than discovered; the median is there because a
 * number that climbs means the cards have got too hard, which is a fact about
 * the deck and not about the reader. No streak, no retention, no heatmap.
 */
function ReviewLoad({ logs }: { logs: ReviewLog[] }) {
  const [now] = useState(() => Date.now());
  if (logs.length === 0) return null;

  const days = reviewsPerDay(logs, now);
  const busiest = Math.max(...days.map((d) => d.count), 1);
  const median = medianDuration(logs);
  // Counted from the strip, not from the whole log: the sentence has to
  // describe the same thirty days the bars above it do.
  const total = days.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <section className={`type-en mt-10 ${muted}`}>
      <div className="flex h-8 items-end gap-[2px]" aria-hidden>
        {days.map(({ day, count }) => (
          <span
            key={day}
            className="flex-1 bg-graphite dark:bg-lamp-gph"
            // A day with no reviews keeps a hairline rather than vanishing:
            // the gaps in the strip are as informative as the bars.
            style={{ height: count === 0 ? 1 : `${Math.max(8, (count / busiest) * 100)}%` }}
          />
        ))}
      </div>

      <p className="mt-2">
        {total} {total === 1 ? 'review' : 'reviews'} in 30 days
        {median !== null && `, typically ${formatSeconds(median)} a card`}.
      </p>
    </section>
  );
}

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * The whole of the app's self-reporting.
 *
 * Flip rate and nothing else: no words-learned total, no time-read total, no
 * streak. Any second number here would immediately become a thing to optimise,
 * and the first casualty would be honest flipping.
 */
export default function StatsPage() {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [] as Session[]);
  const logs = useLiveQuery(() => db.reviews.toArray(), [], [] as ReviewLog[]);
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);

  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  const readable = useMemo(() => readableSessions(sessions ?? []), [sessions]);
  const newestFirst = useMemo(() => readable.slice().reverse(), [readable]);

  // Reviewing and reading are separate habits and either can run ahead of the
  // other. Someone grading cards on a train has review history worth showing
  // even before a reading session has met the threshold.
  if (readable.length === 0) {
    return (
      <Page title="Flip rate">
        <p className={`type-en ${muted}`}>
          No reading sessions yet. Read a few paragraphs and this fills in.
        </p>
        <ReviewLoad logs={logs ?? []} />
      </Page>
    );
  }

  return (
    <Page title="Flip rate">
      <FlipPlot sessions={readable} />

      <p className="type-en mt-8">{interpret(readable)}</p>

      <ReviewLoad logs={logs ?? []} />

      <ul className="mt-8">
        {newestFirst.map((session) => (
          <li
            key={session.id}
            className="flex min-h-14 items-baseline justify-between gap-4 border-b border-rule py-3 dark:border-lamp-gph/25"
          >
            <span className="min-w-0">
              <span className="block truncate">{titles.get(session.docId) ?? 'Deleted text'}</span>
              <span className={`type-en block ${muted}`}>
                {formatDate(session.startedAt)} · {formatDuration(duration(session))} ·{' '}
                {session.paragraphsViewed}{' '}
                {session.paragraphsViewed === 1 ? 'paragraph' : 'paragraphs'}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatRate(session.flipRate)}</span>
          </li>
        ))}
      </ul>
    </Page>
  );
}
