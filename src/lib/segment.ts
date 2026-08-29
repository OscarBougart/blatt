/**
 * German word boundaries, for rendering each token as its own tappable span.
 *
 * Keeps hyphenated compounds (`Sonnen-Blume`) and apostrophes (`geht's`,
 * `geht’s`) as single words, because tapping one should save the whole
 * compound rather than half of it.
 */
const WORD = /[A-Za-zÄÖÜäöüßẞ]+(?:[-'’][A-Za-zÄÖÜäöüßẞ]+)*/g;

export interface Token {
  text: string;
  isWord: boolean;
  /** Offset of this token within the paragraph. */
  start: number;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/**
 * Split a paragraph into an alternating run of word and non-word tokens.
 *
 * Every character of the paragraph appears in exactly one token, so rendering
 * the tokens in order reproduces the paragraph exactly — punctuation, spacing
 * and all. That property is what lets the reading view be made of spans
 * without changing a single glyph on screen.
 */
export function tokenizeForDisplay(text: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of text.matchAll(WORD)) {
    const start = match.index;
    if (start > cursor) {
      tokens.push({ text: text.slice(cursor, start), isWord: false, start: cursor });
    }
    tokens.push({ text: match[0], isWord: true, start });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), isWord: false, start: cursor });
  }
  return tokens;
}

/**
 * Sentence spans within a paragraph, with their offsets.
 *
 * A saved word stores the sentence it came from and its offset *within that
 * sentence*, so the word list can show the word in context and highlight the
 * exact occurrence that was tapped.
 */
export function sentencesOf(text: string): Sentence[] {
  const out: Sentence[] = [];
  // A sentence ends at terminal punctuation, optionally followed by a closing
  // quote or bracket, and only when the next sentence actually starts. German
  // capitalises the first word, so requiring a capital (or an opening quote)
  // keeps `z.B. spät` and `d.h. dann` in one piece — abbreviations are far more
  // common in real prose than a sentence starting lowercase.
  const boundary = /[.!?…]+["'”’“»›)\]]*\s+(?=[A-ZÄÖÜ„“»‚‘"'(])/g;
  let start = 0;

  for (const match of text.matchAll(boundary)) {
    const end = match.index + match[0].length;
    const slice = text.slice(start, end).trim();
    if (slice) out.push({ text: slice, start, end });
    start = end;
  }

  const tail = text.slice(start).trim();
  if (tail) out.push({ text: tail, start, end: text.length });

  return out;
}

/** The sentence containing a paragraph offset, and the offset within it. */
export function locate(
  paragraph: string,
  offsetInParagraph: number,
): { sentence: string; charOffset: number } {
  for (const sentence of sentencesOf(paragraph)) {
    if (offsetInParagraph >= sentence.start && offsetInParagraph < sentence.end) {
      // `start` is the raw span; the stored text is trimmed, so re-find the
      // trimmed sentence's true beginning before measuring the offset.
      const lead = paragraph.slice(sentence.start, sentence.end).search(/\S/);
      return {
        sentence: sentence.text,
        charOffset: offsetInParagraph - sentence.start - Math.max(0, lead),
      };
    }
  }
  return { sentence: paragraph, charOffset: offsetInParagraph };
}
