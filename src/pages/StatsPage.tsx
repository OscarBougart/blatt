import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import FlipPlot from '@/components/FlipPlot';
import Page from '@/components/Page';
import { db } from '@/db/db';
import type { Session } from '@/db/types';
import {
  duration,
  formatDuration,
  formatRate,
  interpret,
  readableSessions,
} from '@/lib/stats';

const muted = 'text-graphite dark:text-lamp-gph';

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
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);

  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  const readable = useMemo(() => readableSessions(sessions ?? []), [sessions]);
  const newestFirst = useMemo(() => readable.slice().reverse(), [readable]);

  if (readable.length === 0) {
    return (
      <Page title="Flip rate">
        <p className={`type-en ${muted}`}>
          No reading sessions yet. Read a few paragraphs and this fills in.
        </p>
      </Page>
    );
  }

  return (
    <Page title="Flip rate">
      <FlipPlot sessions={readable} />

      <p className="type-en mt-8">{interpret(readable)}</p>

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
