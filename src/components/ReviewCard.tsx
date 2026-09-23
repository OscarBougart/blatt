import type { SavedWord } from '@/db/types';
import { cloze } from '@/lib/cloze';
import type { SessionStyle } from '@/lib/queue';
import { formatDays, GRADES, GRADE_LABEL, schedule, type Grade } from '@/lib/srs';

interface Props {
  word: SavedWord;
  docTitle: string;
  style: SessionStyle;
  revealed: boolean;
  /** The reader asked for a hint before answering. */
  hinted: boolean;
  onReveal: () => void;
  onHint: () => void;
  onGrade: (grade: Grade) => void;
}

const rule = 'border-rule dark:border-lamp-gph/25';
const muted = 'text-graphite dark:text-lamp-gph';

/** The answer, wherever it appears. The one coloured thing on a card. */
const answer = 'text-reveal dark:text-lamp-reveal';

/** Quiet, bordered, thumb-sized. A control, not a heading. */
const button = `min-h-12 rounded-sm border px-4 transition-colors active:bg-ink/5 dark:active:bg-lamp-ink/10 ${rule} ${muted}`;

/**
 * The target word, hidden or shown, taking the same space either way:
 * transparent glyphs over a rule, not a blank measured in `ch`. A `ch` blank
 * only approximates proportional type, so the sentence reflowed at the exact
 * moment the reader was checking their answer.
 *
 * The blank is kept whole: a rule broken across two lines reads as two short
 * blanks, and the reader counts the wrong number of words. Revealed, normal
 * breaking comes back — a German compound long enough to need it would
 * otherwise run out of the column.
 */
function Slot({ word, revealed }: { word: string; revealed: boolean }) {
  const hidden = 'blank inline-block whitespace-nowrap';
  return <span className={revealed ? answer : hidden}>{word}</span>;
}

export default function ReviewCard({
  word,
  docTitle,
  style,
  revealed,
  hinted,
  onReveal,
  onHint,
  onGrade,
}: Props) {
  const wordOnly = style === 'word';
  // Every occurrence is blanked: a front that shows the word is not a question.
  const segments = cloze(word.sentence, word.surface);
  const definition = word.note?.trim() || word.definition;

  // A word card already shows the definition, so there is nothing to hint
  // with. Elsewhere the hint is the word's own gloss — close to the answer on
  // a recognition card, which is what Tipp is for.
  const canHint = !wordOnly && Boolean(definition);

  // Every preview on the grade bar is measured from one instant, so the four
  // intervals are comparable with each other.
  const now = Date.now();

  return (
    <>
      {/* The slip itself. A hairline and a radius, nothing more: enough to
          make the question and its answer one object rather than two runs of
          text adrift on the page. */}
      <div className={`rounded-sm border p-6 ${rule}`}>
        <div key={`${word.id}-${style}`} className="card-in text-left">
          {wordOnly ? (
            <>
              <p className="type-en">
                {definition || <span className={muted}>No definition.</span>}
              </p>
              {revealed && (
                <p className={`type-de mt-6 ${answer}`} lang="de">
                  {word.lemma}
                </p>
              )}
            </>
          ) : (
            <p className="type-de" lang="de">
              {segments.map((segment, i) =>
                segment.hidden ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <Slot key={i} word={segment.text} revealed={revealed} />
                ) : (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={i}>{segment.text}</span>
                ),
              )}
            </p>
          )}

          {/* The hint proper: what this one word means. */}
          {hinted && !revealed && definition && (
            <p className={`type-en mt-4 ${muted}`}>{definition}</p>
          )}
        </div>

        {revealed ? (
          <div className={`mt-8 border-t pt-6 ${rule}`}>
            {/* The lemma is already above on a word card; only the inflected
                form it was read in is worth adding. */}
            {wordOnly ? (
              word.surface !== word.lemma && (
                <p className={`type-en ${muted}`} lang="de">
                  As read: {word.surface}
                </p>
              )
            ) : (
              <>
                <p className="flex items-baseline gap-2">
                  <span className={`text-lg ${answer}`} lang="de">
                    {word.surface}
                  </span>
                  {word.lemma !== word.surface && (
                    <span className={`type-en ${muted}`} lang="de">
                      {word.lemma}
                    </span>
                  )}
                </p>

                {/* Graphite, like every other English gloss in the app. At
                    full ink it read as loud as the German above it. */}
                <p className={`type-en mt-2 ${muted}`}>
                  {definition || <span className={muted}>No definition.</span>}
                </p>
              </>
            )}

            <p className={`type-en mt-4 ${muted}`}>{docTitle}</p>
          </div>
        ) : (
          <div className={`mt-8 flex gap-3 border-t pt-6 ${rule}`}>
            <button type="button" onClick={onReveal} className={button}>
              Show
            </button>
            {canHint && !hinted && (
              <button type="button" onClick={onHint} className={button}>
                Tipp
              </button>
            )}
          </div>
        )}
      </div>

      {revealed && (
        <div
          className={`card-in fixed inset-x-0 bottom-[var(--nav-clear)] border-t bg-paper dark:bg-lamp ${rule}`}
        >
          <div className="mx-auto flex max-w-prose">
            {GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGrade(grade)}
                className="flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[15px] transition-colors active:bg-ink/5 dark:active:bg-lamp-ink/10"
              >
                <span>{GRADE_LABEL[grade]}</span>
                {/* What the button actually does to the schedule. `schedule`
                    is the same pure function `gradeCard` commits, so the
                    preview cannot drift from the interval the reader gets. */}
                <span className={`text-[13px] ${muted}`}>
                  {formatDays(schedule(word, grade, now).interval)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
