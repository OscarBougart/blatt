import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import CardGroups from '@/components/CardGroups';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import TextFlips from '@/components/TextFlips';
import { db } from '@/db/db';
import type { ReviewLog, SavedWord, Session } from '@/db/types';
import {
  countingSince,
  formatSeconds,
  medianDuration,
  reviewsPerDay,
  totalFlips,
} from '@/lib/stats';

const muted = 'text-graphite dark:text-lamp-gph';

/**
 * Two footnotes to the flips: how much is arriving, and how long a card
 * takes. A climbing median means the deck has got too hard.
 */
function ReviewLoad({ logs }: { logs: ReviewLog[] }) {
  const [now] = useState(() => Date.now());
  if (logs.length === 0) return null;

  const days = reviewsPerDay(logs, now);
  const median = medianDuration(logs);
  // The last thirty days only, not the whole log: the sentence says so.
  const total = days.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;

  return (
    <section className={`type-en mt-10 ${muted}`}>
      <p>
        {total} {total === 1 ? 'review' : 'reviews'} in 30 days
        {median !== null && `, typically ${formatSeconds(median)} a card`}.
      </p>
    </section>
  );
}

function formatDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Flips and nothing else as the headline. A second headline number would
 * become a thing to optimise, and honest flipping would be the first casualty.
 * The amber is the signal, spent here and nowhere else in the app.
 */
function Headline({ sessions }: { sessions: Session[] }) {
  const since = countingSince(sessions);

  if (since === null) {
    return (
      <p className={`type-en ${muted}`}>
        Every flip to English is counted from your next reading session.
      </p>
    );
  }

  const flips = totalFlips(sessions);
  return (
    <div>
      <p className="text-5xl leading-none tabular-nums text-signal">{flips}</p>
      <p className={`type-en mt-3 ${muted}`}>
        {flips === 1 ? 'flip' : 'flips'} to English since {formatDate(since)}
      </p>
    </div>
  );
}

export default function StatsPage() {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [] as Session[]);
  const logs = useLiveQuery(() => db.reviews.toArray(), [], [] as ReviewLog[]);
  const words = useLiveQuery(() => db.words.toArray(), [], [] as SavedWord[]);
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);

  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  // Flashcards and review history are worth showing before any reading.
  if ((sessions ?? []).length === 0) {
    return (
      <Page title="Flips">
        <EmptyState to="/" action="Find something to read">
          No reading yet. Read a text, and every flip to English is counted here.
        </EmptyState>
        <CardGroups words={words ?? []} logs={logs ?? []} />
        <ReviewLoad logs={logs ?? []} />
      </Page>
    );
  }

  return (
    <Page title="Flips">
      <Headline sessions={sessions ?? []} />

      <TextFlips sessions={sessions ?? []} titles={titles} />

      <CardGroups words={words ?? []} logs={logs ?? []} />

      <ReviewLoad logs={logs ?? []} />
    </Page>
  );
}
