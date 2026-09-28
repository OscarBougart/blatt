import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import Page from '@/components/Page';
import WordRow from '@/components/WordRow';
import { db } from '@/db/db';
import type { ReviewLog, SavedWord } from '@/db/types';
import { CARD_GROUP_LABEL, groupOf, lastGrades, parseGroup } from '@/lib/cardGroups';
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
 *
 * One more filter arrives only from Stats: `?grade=hard` and the like, the
 * words in one of the flashcard groups. It lives in the URL rather than in a
 * control here, so the list keeps its two filters and the back arrow returns
 * to Stats.
 */
export default function WordsPage() {
  const [query, setQuery] = useState('');
  const [docId, setDocId] = useState<string | 'all'>('all');
  const [params, setParams] = useSearchParams();
  const group = parseGroup(params.get('grade'));

  const words = useLiveQuery(() => db.words.toArray(), [], [] as SavedWord[]);
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);
  // Only read when a grade filter is on; the plain list never needs the log.
  const logs = useLiveQuery(
    () => (group ? db.reviews.toArray() : Promise.resolve([] as ReviewLog[])),
    [group],
    [] as ReviewLog[],
  );

  const visible = useMemo(() => {
    const filtered = filterWords(words ?? [], { query, docId });
    if (!group) return sortWords(filtered);
    const grades = lastGrades(logs ?? []);
    return sortWords(filtered.filter((word) => groupOf(word.id, grades) === group));
  }, [words, query, docId, group, logs]);

  const clearGroup = () => setParams({}, { replace: true });

  return (
    <Page title="Words">
      {group && (
        <p className="type-en mb-4 flex min-h-12 items-center justify-between gap-4">
          {group === 'new' ? (
            <span className="font-semibold">{CARD_GROUP_LABEL.new}</span>
          ) : (
            <span>
              Last graded <span className="font-semibold">{CARD_GROUP_LABEL[group]}</span>
            </span>
          )}
          <button
            type="button"
            onClick={clearGroup}
            className={`min-h-12 underline underline-offset-4 ${muted}`}
          >
            Show all words
          </button>
        </p>
      )}

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
                clearGroup();
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
