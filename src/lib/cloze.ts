/**
 * Splitting a sentence around the one occurrence that was tapped.
 *
 * The sentence is the whole reason it was stored: a word recalled inside the
 * clause it was read in is a word you can actually use. So the card front
 * blanks the word and keeps everything around it.
 */
export interface Cloze {
  before: string;
  /** The hidden word, for the reveal and for sizing the blank. */
  hidden: string;
  after: string;
}

/**
 * Blank the occurrence at `charOffset`, not the first one.
 *
 * A word can appear several times in a sentence — "Der Mann sah den Mann" —
 * and blanking the wrong one gives away the answer and asks about something
 * that was never saved. The offset is trusted only if the text actually sits
 * there; a corrected lemma or an edited sentence can leave it stale, so a
 * mismatch falls back to the first occurrence, then to no blank at all.
 */
export function cloze(sentence: string, surface: string, charOffset: number): Cloze {
  if (!surface) return { before: sentence, hidden: '', after: '' };

  const end = charOffset + surface.length;
  const exact =
    charOffset >= 0 && end <= sentence.length && sentence.slice(charOffset, end) === surface;

  const start = exact ? charOffset : sentence.indexOf(surface);
  if (start < 0) return { before: sentence, hidden: '', after: '' };

  return {
    before: sentence.slice(0, start),
    hidden: sentence.slice(start, start + surface.length),
    after: sentence.slice(start + surface.length),
  };
}
