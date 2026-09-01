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

  // What a session would actually contain, not how many words are past due —
  // otherwise a fortnight of saving shows "400 due", the exact feeling the
  // daily limit exists to prevent.
  //
  // Date.now() is read inside the query, not at mount: on a first launch the
  // demo seed is still writing when this renders, so a mount-time clock is
  // earlier than the moment its words fall due and the badge never appears.
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
      {/* A count, and only when it is not zero. */}
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

          {/* Behind a toggle so the library reads as a list of texts rather
              than a row of controls. */}
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
