import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Page from '@/components/Page';
import { db } from '@/db/db';
import type { SavedWord } from '@/db/types';
import { deleteWord, retryLookup, setLemma, setNote } from '@/lib/corrections';
import { applySentence, findBetterSentence } from '@/lib/reroll';

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/** The sentence, with the tapped occurrence in ink and the rest in graphite. */
function Context({ word }: { word: SavedWord }) {
  const start = word.charOffset;
  const end = start + word.surface.length;
  const valid =
    start >= 0 && end <= word.sentence.length && word.sentence.slice(start, end) === word.surface;

  if (!valid) return <span className={muted}>{word.sentence}</span>;

  return (
    <span className={muted}>
      {word.sentence.slice(0, start)}
      <span className="text-ink dark:text-lamp-ink">{word.surface}</span>
      {word.sentence.slice(end)}
    </span>
  );
}

/**
 * One word, on its own screen: what it means, where it came from, and every
 * correction that can be made to it. The list stays a list.
 */
export default function WordDetailPage() {
  const { wordId } = useParams();
  const navigate = useNavigate();
  const back = () => void navigate('/words');

  const word = useLiveQuery(
    async () => (wordId ? ((await db.words.get(wordId)) ?? null) : null),
    [wordId],
  );
  const doc = useLiveQuery(
    async () => (word ? ((await db.docs.get(word.docId)) ?? null) : null),
    [word?.docId],
  );

  const [typedLemma, setTypedLemma] = useState('');
  const [busy, setBusy] = useState(false);
  const [rerolled, setRerolled] = useState<'none' | 'done' | null>(null);

  if (word === undefined) return <Page title="Word" hideTitle back={back} />;

  if (word === null) {
    return (
      <Page title="Word" back={back}>
        <p className={`type-en ${muted}`}>That word is no longer saved.</p>
      </Page>
    );
  }

  // Bound after the guards above: the narrowing does not survive into the
  // hoisted helpers below, which close over this instead.
  const saved: SavedWord = word;

  const candidates = doc?.lemmaMap?.[word.surface] ?? [];
  const others = candidates.filter((c) => c.lemma !== word.lemma).slice(0, 4);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Rebuild this card from a better sentence.
   *
   * Offered on every word, but it is here for the leeches. Six failures says
   * the sentence is the problem, and the documented remedy is to rebuild the
   * card from different context — half an hour of work in Anki, one tap here,
   * because the corpus is already lemmatised and already aligned.
   */
  async function reroll() {
    setRerolled(null);
    const better = await findBetterSentence(saved);
    if (!better) {
      setRerolled('none');
      return;
    }
    await applySentence(saved, better);
    setRerolled('done');
  }

  return (
    <Page title={word.surface} back={back} hideTitle>
      <p className="flex items-baseline gap-2">
        <span className="text-2xl" lang="de">
          {word.surface}
        </span>
        {word.lemma !== word.surface && (
          <span className={`type-en ${muted}`} lang="de">
            {word.lemma}
          </span>
        )}
      </p>

      <p className="type-en mb-5 mt-2">
        {word.note?.trim() || word.definition || <span className={muted}>No definition.</span>}
      </p>

      <p className="type-de mb-2" lang="de">
        <Context word={word} />
      </p>
      <p className={`type-en mb-8 ${muted}`}>{doc?.title ?? ''}</p>

      {/* Lemma correction: pick what the cascade offered, or type one. */}
      <div className="mb-6">
        <span className={`type-en ${muted}`}>Lemma</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`min-h-12 border px-3 py-2 ${rule}`} lang="de">
            {word.lemma}
          </span>
          {others.map((candidate) => (
            <button
              key={candidate.lemma}
              type="button"
              disabled={busy}
              onClick={() => void run(() => setLemma(word, candidate.lemma))}
              className={`min-h-12 border px-3 py-2 ${rule} ${muted}`}
              lang="de"
            >
              {candidate.lemma}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            value={typedLemma}
            onChange={(event) => setTypedLemma(event.target.value)}
            placeholder="or type one"
            aria-label="Type a lemma"
            lang="de"
            className={`min-h-12 flex-1 border-b bg-transparent py-2 outline-none ${rule}`}
          />
          <button
            type="button"
            disabled={busy || !typedLemma.trim()}
            onClick={() =>
              void run(async () => {
                await setLemma(word, typedLemma);
                setTypedLemma('');
              })
            }
            className={`min-h-12 border px-4 ${rule} disabled:opacity-40`}
          >
            Set
          </button>
        </div>
      </div>

      {/* The reader's own definition. Never overwritten by a later fetch.
          A label rather than a div, so the caption is also the field's name —
          a screen reader otherwise announced an unnamed text area. */}
      <label className="mb-6 block">
        <span className={`type-en ${muted}`}>Your definition</span>
        {/* Uncontrolled, keyed by the word: the stored note seeds it once and
            the field is the reader's from then on, saved when they leave it. */}
        <textarea
          key={word.id}
          defaultValue={word.note ?? ''}
          onBlur={(event) => void run(() => setNote(saved, event.target.value))}
          rows={2}
          className={`mt-2 w-full resize-y border-b bg-transparent py-2 font-[inherit] outline-none ${rule}`}
        />
      </label>

      {/* A suspended leech says so, and says what to do about it. */}
      {word.leechFlaggedAt !== undefined && (
        <p className={`type-en mb-4 ${muted}`}>
          Failed {word.lapses} times and set aside. The sentence is usually the problem rather
          than the memory — try another one.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(reroll)}
          className={`min-h-12 border px-4 ${rule}`}
        >
          Another sentence
        </button>
        {word.lookupFailed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => retryLookup(word))}
            className={`min-h-12 border px-4 ${rule}`}
          >
            Retry lookup
          </button>
        )}
      </div>

      {rerolled === 'none' && (
        <p role="status" className={`type-en mb-4 ${muted}`}>
          No better sentence in anything you have read. Keep this one, read more, or delete the
          word.
        </p>
      )}
      {rerolled === 'done' && (
        <p role="status" className="type-en mb-4">
          Rebuilt from a cleaner sentence.
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await deleteWord(word.id);
            // The page it was showing is gone; going back is the only sane end.
            void navigate('/words');
          })
        }
        className={`min-h-12 min-w-12 text-left ${muted}`}
      >
        Delete
      </button>
    </Page>
  );
}
