import type { SavedWord } from '@/db/types';
import { cloze } from '@/lib/cloze';
import { GRADES, GRADE_LABEL, formatDays, previewInterval, type Grade } from '@/lib/srs';

interface Props {
  word: SavedWord;
  docTitle: string;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: Grade) => void;
}

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/**
 * The blank. Sized in `ch` from the word it hides, so a long compound leaves a
 * long gap — the shape of the sentence survives, which is a fair part of the
 * clue and the whole reason for asking in context.
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

export default function ReviewCard({ word, docTitle, revealed, onReveal, onGrade }: Props) {
  const { before, hidden, after } = cloze(word.sentence, word.surface, word.charOffset);
  const definition = word.note?.trim() || word.definition;

  return (
    <>
      {/* The sentence stays put when the answer appears: the card does not
          re-flow under your eyes at the moment you are checking yourself. */}
      <p className="type-de" lang="de">
        {before}
        {hidden && (revealed ? <span>{hidden}</span> : <Blank width={hidden.length} />)}
        {after}
      </p>

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
          <p className={`type-en mt-4 ${muted}`}>{docTitle}</p>
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

      {/* Grade buttons sit above the nav bar, within thumb reach, and carry the
          interval each one buys. The cost of an answer is not a secret. */}
      {revealed && (
        <div
          className={`fixed inset-x-0 bottom-12 border-t bg-paper dark:bg-lamp ${rule}`}
        >
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
