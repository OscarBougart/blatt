/**
 * Splitting a sentence around the word being reviewed.
 *
 * The sentence is the whole reason it was stored: a word recalled inside the
 * clause it was read in is a word you can actually use. So the card front
 * blanks the word and keeps everything around it.
 */
export interface Segment {
  text: string;
  /** True for the word itself: rendered as a blank until the reveal. */
  hidden: boolean;
}

/** Letters that count as part of a word, so a match inside a longer one is not a match. */
const LETTER = /[\p{L}\p{N}]/u;

function isBoundary(char: string | undefined): boolean {
  return char === undefined || !LETTER.test(char);
}

/**
 * Blank every occurrence of `surface`, not just the one that was tapped.
 *
 * A word often appears more than once in the same sentence — "Der Mann sah den
 * Mann" — and leaving the others standing hands the reader the answer. Matching
 * ignores case, because the same word is capitalised at the start of a sentence
 * and not in the middle, and stops at word boundaries so "der" does not blank
 * a hole in "andere".
 *
 * A surface that does not occur at all leaves the sentence whole: better an
 * unhelpful card than a corrupted one.
 */
export function cloze(sentence: string, surface: string): Segment[] {
  if (!surface) return [{ text: sentence, hidden: false }];

  const haystack = sentence.toLowerCase();
  const needle = surface.toLowerCase();
  const segments: Segment[] = [];
  // Two cursors: `emitted` is how much of the sentence has been output, `from`
  // is where the next search starts. A match rejected for sitting inside a
  // longer word advances only the search, or its text would be dropped.
  let emitted = 0;
  let from = 0;

  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;

    const end = at + needle.length;
    if (!isBoundary(sentence[at - 1]) || !isBoundary(sentence[end])) {
      from = at + 1;
      continue;
    }

    if (at > emitted) segments.push({ text: sentence.slice(emitted, at), hidden: false });
    segments.push({ text: sentence.slice(at, end), hidden: true });
    emitted = end;
    from = end;
  }

  if (emitted < sentence.length) segments.push({ text: sentence.slice(emitted), hidden: false });
  return segments.length > 0 ? segments : [{ text: sentence, hidden: false }];
}
