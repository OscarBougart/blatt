import { useEffect, useRef, useState } from 'react';
import {
  TUTORIAL_STEPS,
  advance,
  markTutorialDone,
  tutorialDone,
  type TutorialStep,
} from '@/lib/tutorial';

/** How long the closing line stays before it is taken away. */
const DONE_MS = 6000;

const CAPTION: Record<TutorialStep, string> = {
  flip: 'Swipe left to see the English.',
  return: 'Swipe right to come back to German.',
  save: 'Double-tap any word to save it.',
  done: 'That’s it. Saved words become flashcards in Review. Swipe right from German to leave a text.',
};

export interface ReaderTutorialProps {
  side: 'de' | 'en';
  /** Words saved in this text. A rise during the last step is the save. */
  savedCount: number;
}

/**
 * The first-run lesson: one graphite line at the foot of the page, which moves
 * on only when the gesture it names has been made, and is then gone for good.
 *
 * The same bargain as the exit arrow in ReaderChrome. The reading screen is
 * text and nothing else; a line that teaches the screen's two gestures once
 * and then leaves keeps it that way for every reading after the first.
 */
export default function ReaderTutorial({ side, savedCount }: ReaderTutorialProps) {
  const [active] = useState(() => !tutorialDone());
  const [step, setStep] = useState<TutorialStep>('flip');
  const [gone, setGone] = useState(false);
  /** The saved count when the save step began. Null outside that step. */
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    setStep((current) => advance(current, side));
  }, [side]);

  // Watching the count rather than taking a callback keeps the reader's own
  // save path untouched. The baseline is taken on entering the step, so words
  // that were already saved, or that load late, are not mistaken for a save.
  useEffect(() => {
    if (step !== 'save') {
      baseline.current = null;
      return;
    }
    if (baseline.current === null || savedCount < baseline.current) {
      baseline.current = savedCount;
      return;
    }
    if (savedCount > baseline.current) setStep((current) => advance(current, 'saved'));
  }, [step, savedCount]);

  useEffect(() => {
    if (!active || step !== 'done') return;
    markTutorialDone();
    const timer = setTimeout(() => setGone(true), DONE_MS);
    return () => clearTimeout(timer);
  }, [active, step]);

  if (!active || gone) return null;

  const skip = () => {
    markTutorialDone();
    setGone(true);
  };

  const number = TUTORIAL_STEPS.indexOf(step) + 1;

  return (
    <div
      // A tap here belongs to the tutorial: it must neither start a swipe nor
      // count towards a double-tap on the text.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-10 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] text-graphite dark:border-lamp-gph/25 dark:bg-lamp dark:text-lamp-gph"
    >
      <div className="mx-auto flex max-w-[34rem] items-center gap-3 py-2 pl-7 pr-2">
        <p role="status" aria-live="polite" className="type-en min-w-0 flex-1 py-2">
          {CAPTION[step]}
        </p>
        {step === 'done' ? null : (
          <>
            <span className="type-en shrink-0" aria-label={`Step ${number} of 3`}>
              {number}/3
            </span>
            <button type="button" onClick={skip} className="type-en min-h-12 min-w-12 shrink-0 px-2">
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
