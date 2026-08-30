import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import DocRow from '@/components/DocRow';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { lastExportAt, shouldPromptBackup } from '@/lib/backup';
import { dueWords } from '@/lib/srs';

export default function HomePage() {
  const docs = useLiveQuery(() => db.docs.orderBy('createdAt').reverse().toArray(), []);
  const words = useLiveQuery(() => db.words.toArray(), [], []);

  const counts = useMemo(() => {
    const byDoc = new Map<string, number>();
    for (const word of words ?? []) {
      byDoc.set(word.docId, (byDoc.get(word.docId) ?? 0) + 1);
    }
    return byDoc;
  }, [words]);

  // The clock is read once, on mount. A card coming due while this screen sits
  // open is not worth a timer, and reading Date.now() every render would make
  // the count depend on when React happened to re-render.
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const due = useMemo(() => dueWords(words ?? [], now).length, [words, now]);

  const promptBackup = useMemo(() => {
    const created = (docs ?? []).map((doc) => doc.createdAt);
    return shouldPromptBackup(
      {
        lastExport: lastExportAt(),
        oldestCreatedAt: created.length > 0 ? Math.min(...created) : null,
        savedWords: (words ?? []).length,
      },
      now,
    );
  }, [docs, words, now]);

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
