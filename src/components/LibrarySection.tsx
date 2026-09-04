import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { fetchLibraryIndex, installLibraryText, type LibraryEntry } from '@/lib/library';

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/**
 * The library, at the top of Import.
 *
 * It sits here rather than behind a seventh tab because adding a text from
 * the library and pasting one in are the same errand, and the nav bar is
 * already as wide as a thumb can reach.
 *
 * A reader with nothing to read is the first impression this exists to fix,
 * so it renders nothing at all when the library is empty — an explanation of
 * an absent feature is worse than the absence.
 */
export default function LibrarySection() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const added = useLiveQuery(
    async () => new Set((await db.docs.toArray()).map((doc) => doc.librarySlug)),
    [],
    new Set<string | undefined>(),
  );

  useEffect(() => {
    void fetchLibraryIndex().then(setEntries);
  }, []);

  async function add(entry: LibraryEntry) {
    if (busy) return;
    setBusy(entry.slug);
    setError(null);
    try {
      navigate(`/read/${await installLibraryText(entry.slug)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That text could not be added.');
      setBusy(null);
    }
  }

  if (entries === null || entries.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-lg">Library</h2>
      <p className={`type-en mt-2 ${muted}`}>
        Tales from the Brothers Grimm, ready to read. Nothing is downloaded when you tap —
        it is already here.
      </p>
      <p className={`type-en mt-2 ${muted}`}>
        The German is the 1857 original. The English is machine translated, so trust the
        German where they disagree.
      </p>

      <ul className="mt-4">
        {entries.map((entry) => {
          const here = added.has(entry.slug);
          return (
            <li key={entry.slug} className={`border-b ${rule}`}>
              <button
                type="button"
                onClick={() => void add(entry)}
                disabled={here || busy !== null}
                className="flex min-h-12 w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-40"
              >
                <span lang="de">{entry.title}</span>
                <span className={`type-en shrink-0 ${muted}`}>
                  {here
                    ? 'Added'
                    : busy === entry.slug
                      ? 'Adding…'
                      : `${entry.paragraphs} paragraphs`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="type-en mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
