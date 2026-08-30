import { useState } from 'react';
import type { SavedWord } from '@/db/types';
import type { LemmaCandidate } from '@/lib/lemma/types';
import { deleteWord, retryLookup, setLemma, setNote } from '@/lib/corrections';
import { applySentence, findBetterSentence, setCardMode } from '@/lib/reroll';
import { truncateSentence } from '@/lib/words';

interface Props {
  word: SavedWord;
  candidates: LemmaCandidate[];
  docTitle: string;
  expanded: boolean;
  onToggle: () => void;
}

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

export default function WordRow({ word, candidates, docTitle, expanded, onToggle }: Props) {
  const [note, setNoteText] = useState(word.note ?? '');
  const [typedLemma, setTypedLemma] = useState('');
  const [busy, setBusy] = useState(false);
  const [rerolled, setRerolled] = useState<'none' | 'done' | null>(null);

  const isCloze = word.cardMode === 'cloze';

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
    const better = await findBetterSentence(word);
    if (!better) {
      setRerolled('none');
      return;
    }
    await applySentence(word, better);
    setRerolled('done');
  }

  const others = candidates.filter((c) => c.lemma !== word.lemma).slice(0, 4);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`border-b ${rule}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-14 w-full flex-col justify-center py-3 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-lg" lang="de">
            {word.surface}
          </span>
          {word.lemma !== word.surface && (
            <span className={`type-en ${muted}`} lang="de">
              {word.lemma}
            </span>
          )}
        </span>
        <span className={`type-en mt-1 truncate ${muted}`} lang="de">
          {truncateSentence(word.sentence)}
        </span>
      </button>

      {expanded && (
        <div className="pb-5">
          <p className="type-de mb-4" lang="de">
            <Context word={word} />
          </p>

          <p className="type-en mb-1">
            {word.note?.trim() || word.definition || (
              <span className={muted}>No definition.</span>
            )}
          </p>
          <p className={`type-en mb-5 ${muted}`}>{docTitle}</p>

          {/* Lemma correction: cycle what the cascade offered, or type one. */}
          <div className="mb-4">
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

          {/* The reader's own definition. Never overwritten by a later fetch. */}
          <div className="mb-4">
            <span className={`type-en ${muted}`}>Your definition</span>
            <textarea
              value={note}
              onChange={(event) => setNoteText(event.target.value)}
              onBlur={() => void run(() => setNote(word, note))}
              rows={2}
              className={`mt-2 w-full resize-y border-b bg-transparent py-2 font-[inherit] outline-none ${rule}`}
            />
          </div>

          {/* A suspended leech says so, and says what to do about it. */}
          {word.leechFlaggedAt !== undefined && (
            <p className={`type-en mb-4 ${muted}`}>
              Failed {word.lapses} times and set aside. The sentence is usually the problem
              rather than the memory — try another one.
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => setCardMode(word, isCloze ? 'recognition' : 'cloze'))}
              className={`min-h-12 px-4 ${muted}`}
            >
              {isCloze ? 'Just recognise it' : 'Drill this actively'}
            </button>
          </div>

          {rerolled === 'none' && (
            <p role="status" className={`type-en mb-4 ${muted}`}>
              No better sentence in anything you have read. Keep this one, read more, or delete
              the word.
            </p>
          )}
          {rerolled === 'done' && (
            <p role="status" className="type-en mb-4">
              Rebuilt from a cleaner sentence.
            </p>
          )}

          <div className="flex gap-3">
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
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => deleteWord(word.id))}
              className={`min-h-12 px-4 ${muted}`}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
