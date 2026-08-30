import type { CardMode, SavedWord } from '@/db/types';
import { cloze } from '@/lib/cloze';
import { GRADES, GRADE_LABEL, formatDays, previewInterval, type Grade } from '@/lib/srs';

interface Props {
  word: SavedWord;
  docTitle: string;
  /** The aligned English for the paragraph this sentence came from. */
  translation: string;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
  /** Switch this word between recognition and cloze. */
  onSetMode: (mode: CardMode) => void;
  /** Offer a better sentence for this word, if the corpus holds one. */
  onReroll: () => void;
  rerollState: 'idle' | 'searching' | 'none';
}

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/**
 * The blank, for a cloze card. Sized in `ch` from the word it hides.
 */
function Blank({ width }: { width: number }) {
  return (
    <span
      aria-label="blank"
      className="inline-block border-b border-ink align-baseline dark:border-lamp-ink"
      style={{ width: `${width}ch` }}
    />
  );
}

/**
 * The sentence, with the target at full strength and the rest receding.
 *
 * Emphasis by subtraction: the surrounding words drop to 85% opacity rather
 * than the target going bold or coloured. Bold would change the shape of the
 * word you are being asked to recognise, and colour is spent elsewhere.
 */
function Marked({ sentence, offset, length }: { sentence: string; offset: number; length: number }) {
  const valid = offset >= 0 && offset + length <= sentence.length;
  if (!valid) return <>{sentence}</>;

  return (
    <>
      <span className="opacity-85">{sentence.slice(0, offset)}</span>
      <span>{sentence.slice(offset, offset + length)}</span>
      <span className="opacity-85">{sentence.slice(offset + length)}</span>
    </>
  );
}

/**
 * One card.
 *
 * Recognition by default: the sentence as it was read, with the word marked,
 * and the back giving its meaning plus the aligned translation. That last part
 * is what Anki users write by hand and Blatt already has stored — the reader
 * and the review system share one corpus, so confirmation is free.
 *
 * Cloze is the opt-in, for words worth being able to produce rather than
 * merely recognise.
 */
export default function ReviewCard({
  word,
  docTitle,
  translation,
  revealed,
  onReveal,
  onGrade,
  onSetMode,
  onReroll,
  rerollState,
}: Props) {
  const isCloze = word.cardMode === 'cloze';
  const { before, hidden, after } = cloze(word.sentence, word.surface, word.charOffset);
  const definition = word.note?.trim() || word.definition;

  return (
    <>
      {/* Left-aligned, always. Centred text is fine for a bare word and poor
          for a sentence, and centred multiline prose is the standard
          complaint about Anki's default card. */}
      <div key={word.id} className="card-in text-left">
        <p className="type-de" lang="de">
          {isCloze ? (
            <>
              {before}
              {hidden && (revealed ? <span>{hidden}</span> : <Blank width={hidden.length} />)}
              {after}
            </>
          ) : (
            <Marked sentence={word.sentence} offset={word.charOffset} length={word.surface.length} />
          )}
        </p>

        {/* A cloze front keeps the English as its cue. A German sentence with
            a hole in it is often genuinely unanswerable — several words fit
            the grammar — and asking someone to guess which one was meant is
            not a memory test. */}
        {isCloze && !revealed && translation && (
          <p className={`type-en mt-4 ${muted}`}>{translation}</p>
        )}
      </div>

      {revealed ? (
        <div className={`mt-8 border-t pt-6 ${rule}`}>
          <p className="flex items-baseline gap-2">
            <span className="text-lg" lang="de">
              {word.surface}
            </span>
            {word.lemma !== word.surface && (
              <span className={`type-en ${muted}`} lang="de">
                {word.lemma}
              </span>
            )}
          </p>

          <p className="type-en mt-2">
            {definition || <span className={muted}>No definition.</span>}
          </p>

          {/* The whole paragraph, not just the sentence: it is already aligned,
              and the surrounding lines are what make an ambiguous word obvious. */}
          {!isCloze && translation && (
            <p className={`type-en mt-4 ${muted}`}>{translation}</p>
          )}

          <p className={`type-en mt-4 ${muted}`}>{docTitle}</p>

          <div className={`mt-5 flex flex-wrap items-center gap-4 type-en ${muted}`}>
            <button
              type="button"
              onClick={() => onSetMode(isCloze ? 'recognition' : 'cloze')}
              className="min-h-12 underline underline-offset-4"
            >
              {isCloze ? 'Just recognise it' : 'Drill this actively'}
            </button>

            <button
              type="button"
              onClick={onReroll}
              disabled={rerollState !== 'idle'}
              className="min-h-12 underline underline-offset-4"
            >
              {rerollState === 'searching'
                ? 'Looking…'
                : rerollState === 'none'
                  ? 'No better sentence'
                  : 'Another sentence'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className={`mt-8 min-h-14 w-full border-t pt-6 text-left type-en ${rule} ${muted}`}
        >
          Show
        </button>
      )}

      {revealed && (
        <div className={`fixed inset-x-0 bottom-12 border-t bg-paper dark:bg-lamp ${rule}`}>
          <div className="mx-auto flex max-w-prose">
            {GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGrade(grade)}
                className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1"
              >
                <span className="text-[15px]">{GRADE_LABEL[grade]}</span>
                <span className={`text-[13px] ${muted}`}>
                  {formatDays(previewInterval(word, grade))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
