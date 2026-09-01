import type { CardMode, SavedWord } from '@/db/types';
import { cloze } from '@/lib/cloze';
import type { SessionStyle } from '@/lib/queue';
import { GRADES, GRADE_LABEL, type Grade } from '@/lib/srs';

interface Props {
  word: SavedWord;
  docTitle: string;
  /** The aligned English for the paragraph this sentence came from. */
  translation: string;
  style: SessionStyle;
  revealed: boolean;
  /** The reader asked for a hint before answering. */
  hinted: boolean;
  onReveal: () => void;
  onHint: () => void;
  onGrade: (grade: Grade) => void;
  onSetMode: (mode: CardMode) => void;
  onReroll: () => void;
  rerollState: 'idle' | 'searching' | 'none';
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
 */
function Slot({ word, revealed }: { word: string; revealed: boolean }) {
  return <span className={revealed ? answer : 'blank'}>{word}</span>;
}

/**
 * The sentence with the target at full strength and the rest receding. Not
 * bold: that would change the shape of the word being recognised.
 */
function Marked({
  sentence,
  offset,
  length,
  revealed,
}: {
  sentence: string;
  offset: number;
  length: number;
  revealed: boolean;
}) {
  if (offset < 0 || offset + length > sentence.length) return <>{sentence}</>;

  return (
    <>
      <span className="opacity-85">{sentence.slice(0, offset)}</span>
      <span className={revealed ? answer : undefined}>
        {sentence.slice(offset, offset + length)}
      </span>
      <span className="opacity-85">{sentence.slice(offset + length)}</span>
    </>
  );
}

export default function ReviewCard({
  word,
  docTitle,
  translation,
  style,
  revealed,
  hinted,
  onReveal,
  onHint,
  onGrade,
  onSetMode,
  onReroll,
  rerollState,
}: Props) {
  const isCloze = word.cardMode === 'cloze';
  const wordOnly = style === 'word';
  const { before, hidden, after } = cloze(word.sentence, word.surface, word.charOffset);
  const definition = word.note?.trim() || word.definition;

  // A word card already shows the definition, so there is nothing to hint
  // with. Elsewhere the hint is the word's own gloss — close to the answer on
  // a recognition card, which is what Tipp is for.
  const canHint = !wordOnly && Boolean(definition);

  return (
    <>
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
            {isCloze ? (
              <>
                {before}
                {hidden && <Slot word={hidden} revealed={revealed} />}
                {after}
              </>
            ) : (
              <Marked
                sentence={word.sentence}
                offset={word.charOffset}
                length={word.surface.length}
                revealed={revealed}
              />
            )}
          </p>
        )}

        {/* A cloze keeps the translation as a standing cue — a German sentence
            with a hole in it is often genuinely ambiguous. */}
        {isCloze && !revealed && translation && (
          <p className={`type-en mt-4 ${muted}`}>{translation}</p>
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

              <p className="type-en mt-2">
                {definition || <span className={muted}>No definition.</span>}
              </p>
            </>
          )}

          {/* The aligned paragraph, already stored. */}
          {translation && <p className={`type-en mt-4 ${muted}`}>{translation}</p>}

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

      {revealed && (
        <div className={`card-in fixed inset-x-0 bottom-12 border-t bg-paper dark:bg-lamp ${rule}`}>
          <div className="mx-auto flex max-w-prose">
            {GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => onGrade(grade)}
                className="min-h-16 flex-1 text-[15px] transition-colors active:bg-ink/5 dark:active:bg-lamp-ink/10"
              >
                {GRADE_LABEL[grade]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
