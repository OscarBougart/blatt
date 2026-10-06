import { FLIPPED_KEY } from '@/hooks/useFlipHint';

/**
 * The first-run walk through the reader's gestures, taught by doing them.
 *
 * Nothing on the reading screen advertises the flip, the save or the held
 * definition, and a newcomer handed a bare page of German had no way to guess
 * any of them. Each step waits for the gesture it names, so the lesson is the
 * gesture itself.
 */
export type TutorialStep = 'flip' | 'return' | 'save' | 'define' | 'done';

/** What the reader just did: landed on a side, saved a word, or held one. */
export type TutorialEvent = 'en' | 'de' | 'saved' | 'defined';

/** The steps with a caption and a place in the count. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['flip', 'return', 'save', 'define'];

/** Set once the tutorial has been finished or skipped. */
export const TUTORIAL_KEY = 'blatt:tutorial-done';

/**
 * The step after `step`, given what the reader did. Anything out of order is
 * ignored rather than skipped ahead: saving a word before flipping does not
 * count as having learned the flip.
 */
export function advance(step: TutorialStep, event: TutorialEvent): TutorialStep {
  if (step === 'flip' && event === 'en') return 'return';
  if (step === 'return' && event === 'de') return 'save';
  if (step === 'save' && event === 'saved') return 'define';
  if (step === 'define' && event === 'defined') return 'done';
  return step;
}

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    // No storage: assume it has been seen, rather than teach forever.
    return true;
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // Nothing to do. The tutorial is a courtesy.
  }
}

/** From Settings: run it again on the next text, slide demonstration included. */
export function resetTutorial() {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
    localStorage.removeItem(FLIPPED_KEY);
  } catch {
    // Nothing to do.
  }
}
