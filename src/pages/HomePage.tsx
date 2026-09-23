import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import DocRow from '@/components/DocRow';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import { db } from '@/db/db';
import { lastExportAt, shouldPromptBackup } from '@/lib/backup';

/** A gear. Drawn rather than typed, for the same reason as the back arrow. */
function SettingsLink() {
  return (
    <Link
      to="/settings"
      aria-label="Settings"
      className="-mr-3 flex h-12 w-12 items-center justify-center text-graphite dark:text-lamp-gph"
    >
      <svg viewBox="-1 -1 26 26" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );
}

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

  const [editing, setEditing] = useState(false);

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

  if (docs === undefined) return <Page title="Blatt" aside={<SettingsLink />} />;

  return (
    <Page title="Blatt" aside={<SettingsLink />}>
      {/* Ink, not graphite, and underlined: this is the one thing on the
          screen asking to be acted on, and in graphite it read as a caption
          that happened to be sitting above the library. */}
      {promptBackup && (
        <Link
          to="/settings"
          className="type-en mb-6 flex min-h-12 items-center underline underline-offset-4"
        >
          Not backed up in two weeks
        </Link>
      )}

      {docs.length === 0 ? (
        <EmptyState to="/import" action="Import a text">
          No texts yet.
        </EmptyState>
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

          {/* Import left the tab bar: it is something you do to the library,
              not a fifth place to be. Edit keeps its quiet treatment so the
              screen still reads as a list of texts rather than a row of
              controls. */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <Link
              to="/import"
              className="type-en inline-flex min-h-12 items-center rounded-sm border border-sill-edge px-4 text-graphite dark:border-lamp-sill-edge dark:text-lamp-gph"
            >
              Import a text
            </Link>

            <button
              type="button"
              onClick={() => setEditing((on) => !on)}
              aria-pressed={editing}
              className="type-en flex min-h-12 items-center px-1 text-graphite dark:text-lamp-gph"
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        </>
      )}
    </Page>
  );
}
