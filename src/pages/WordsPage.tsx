import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import WordRow from '@/components/WordRow';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { filterWords, needsAttention, sortWords, type SortMode } from '@/lib/words';

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
 * The word list, and the only place corrections happen — the reader has no
 * word sheet, so a wrong lemma has to be fixable here.
 */
export default function WordsPage() {
  const [query, setQuery] = useState('');
  const [docId, setDocId] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [attention, setAttention] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const words = useLiveQuery(() => db.words.toArray(), [], [] as SavedWord[]);
  const docs = useLiveQuery(() => db.docs.toArray(), [], []);

  const titles = useMemo(
    () => new Map((docs ?? []).map((doc) => [doc.id, doc.title])),
    [docs],
  );

  /** The candidates the cascade produced for a saved word, from its document. */
  const candidatesFor = useMemo(() => {
    const maps = new Map((docs ?? []).map((doc) => [doc.id, doc.lemmaMap ?? {}]));
    return (word: SavedWord): LemmaCandidate[] | undefined =>
      maps.get(word.docId)?.[word.surface];
  }, [docs]);

  const visible = useMemo(
    () =>
      sortWords(
        filterWords(words ?? [], { query, docId, needsAttention: attention }, candidatesFor),
        sort,
      ),
    [words, query, docId, attention, sort, candidatesFor],
  );

  const attentionCount = useMemo(
    () => (words ?? []).filter((w) => needsAttention(w, candidatesFor(w))).length,
    [words, candidatesFor],
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

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Choice active={sort === 'recent'} onClick={() => setSort('recent')}>
          Recent
        </Choice>
        <Choice active={sort === 'overdue'} onClick={() => setSort('overdue')}>
          Overdue
        </Choice>

        <span className={`px-2 ${muted}`}>·</span>

        <Choice active={attention} onClick={() => setAttention((on) => !on)}>
          Needs attention{attentionCount > 0 && ` (${attentionCount})`}
        </Choice>
      </div>

      {(docs?.length ?? 0) > 1 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
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
        <p className={`type-en mt-8 ${muted}`}>
          {(words?.length ?? 0) === 0
            ? 'No words yet. Double-tap a word while reading.'
            : 'Nothing matches.'}
        </p>
      ) : (
        <ul className="mt-6">
          {visible.map((word) => (
            <WordRow
              key={word.id}
              word={word}
              candidates={candidatesFor(word) ?? []}
              docTitle={titles.get(word.docId) ?? ''}
              expanded={expandedId === word.id}
              onToggle={() => setExpandedId((id) => (id === word.id ? null : word.id))}
            />
          ))}
        </ul>
      )}
    </Page>
  );
}
