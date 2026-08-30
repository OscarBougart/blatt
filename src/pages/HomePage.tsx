import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePace } from '@/context/PaceContext';
import DocRow from '@/components/DocRow';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { lastExportAt, shouldPromptBackup } from '@/lib/backup';
import { composeSession } from '@/lib/queue';

export default function HomePage() {
  const { newPerDay } = usePace();
  const docs = useLiveQuery(() => db.docs.orderBy('createdAt').reverse().toArray(), []);
  const words = useLiveQuery(() => db.words.toArray(), [], []);

  const counts = useMemo(() => {
    const byDoc = new Map<string, number>();
    for (const word of words ?? []) {
      byDoc.set(word.docId, (byDoc.get(word.docId) ?? 0) + 1);
    }
    return byDoc;
  }, [words]);

  const [editing, setEditing] = useState(false);

  /**
   * Counted inside the query, not during render.
   *
   * The clock has to be read when the data changes rather than when the
   * component mounted. On a first launch the demo is still installing when
   * this screen first renders, so a `now` captured at mount is earlier than
   * the moment its six words become due — and the badge never appeared at
   * all for the one visitor it exists for. Reading Date.now() during render
   * would fix that and make the count depend on when React re-rendered
   * instead; this way it depends on the words.
   */
  /**
   * What a session would actually contain, not how many words exist.
   *
   * Counting every word whose `dueAt` has passed would include the whole
   * queue, so a reader who saved four hundred words in a fortnight would be
   * met by "400 due" — the precise feeling the daily limit exists to prevent.
   * The badge promises what pressing it delivers.
   */
  const due = useLiveQuery(
    async () => {
      const { due: cards, fresh } = composeSession(await db.words.toArray(), {
        newPerDay,
        now: Date.now(),
      });
      return cards.length + fresh.length;
    },
    [newPerDay],
    0,
  );

  // A fortnight's threshold does not care about milliseconds, so this one can
  // safely be answered from the data as it arrives.
  const promptBackup = useLiveQuery(async () => {
    const [allDocs, allWords] = await Promise.all([db.docs.toArray(), db.words.toArray()]);
    const created = allDocs.map((doc) => doc.createdAt);
    return shouldPromptBackup(
      {
        lastExport: lastExportAt(),
        oldestCreatedAt: created.length > 0 ? Math.min(...created) : null,
        savedWords: allWords.length,
      },
      Date.now(),
    );
  }, [], false);

  if (docs === undefined) return <Page title="Blatt" />;

  return (
    <Page title="Blatt">
      {/* The one number worth surfacing here: how much is waiting. Not a
          streak, not a flame — a count, and only when it is not zero. */}
      {due > 0 && (
        <Link
          to="/review"
          className="type-en mb-6 flex min-h-12 items-center text-graphite dark:text-lamp-gph"
        >
          {due} due
        </Link>
      )}

      {promptBackup && (
        <Link
          to="/settings"
          className="type-en mb-6 flex min-h-12 items-center text-graphite dark:text-lamp-gph"
        >
          Not backed up in two weeks
        </Link>
      )}

      {docs.length === 0 ? (
        <p className="type-en text-graphite dark:text-lamp-gph">
          No texts yet. Import one to begin.
        </p>
      ) : (
        <>
          <ul>
            {docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                savedWords={counts.get(doc.id) ?? 0}
                editing={editing}
              />
            ))}
          </ul>

          {/* A text could be added but never removed, which left the demo
              stuck in the library for good. Kept behind a toggle so the
              library stays a list of things to read rather than a row of
              controls. */}
          <button
            type="button"
            onClick={() => setEditing((on) => !on)}
            aria-pressed={editing}
            className="type-en mt-4 flex min-h-12 items-center text-graphite dark:text-lamp-gph"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        </>
      )}
    </Page>
  );
}
