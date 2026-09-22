import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import WordRow from '@/components/WordRow';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { filterWords, sortWords } from '@/lib/words';

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 px-3 ${active ? 'text-ink dark:text-lamp-ink' : muted}`}
    >
      {children}
    </button>
  );
}

/**
 * Every word saved, newest first. Search and a filter by text, and nothing
 * else: this is a record of your reading, not a list of jobs. Corrections
 * happen on a word's own page.
 */
export default function WordsPage() {
  const [query, setQuery] = useState('');
  const [docId, setDocId] = useState<string | 'all'>('all');

  const words = useLiveQuery(() => db.words.toArray(), [], [] as SavedWord[]);
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);

  const visible = useMemo(
    () => sortWords(filterWords(words ?? [], { query, docId })),
    [words, query, docId],
  );

  return (
    <Page title="Words">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
        aria-label="Search words"
        className={`min-h-12 w-full border-b bg-transparent py-2 outline-none ${rule}`}
      />

      {(docs?.length ?? 0) > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Choice active={docId === 'all'} onClick={() => setDocId('all')}>
            All texts
          </Choice>
          {(docs ?? []).map((doc) => (
            <Choice key={doc.id} active={docId === doc.id} onClick={() => setDocId(doc.id)}>
              {doc.title}
            </Choice>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8">
          {(words?.length ?? 0) === 0 ? (
            <EmptyState to="/" action="Find something to read">
              No words yet. Double-tap a word while reading.
            </EmptyState>
          ) : (
            // A stale text filter and a search term are easy to end up behind
            // at once, and clearing them one at a time means guessing which of
            // the two is hiding the word.
            <EmptyState
              action="Clear search"
              onAction={() => {
                setQuery('');
                setDocId('all');
              }}
            >
              Nothing matches.
            </EmptyState>
          )}
        </div>
      ) : (
        <ul className="mt-6">
          {visible.map((word) => (
            <WordRow key={word.id} word={word} />
          ))}
        </ul>
      )}
    </Page>
  );
}
