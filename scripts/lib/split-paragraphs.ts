/**
 * Cut long source paragraphs into flip-sized ones.
 *
 * Wikisource paragraphs are set for a printed page, not for a phone: two of
 * the twelve tales are a single paragraph, and several run past four hundred
 * words. The flip is the whole interaction of this app, and a flip that hands
 * over four hundred words of English at once is not a glance at a gloss, it
 * is switching languages.
 *
 * Splitting is safe here in a way it would never be for a found translation:
 * the English is generated from these chunks afterwards, so the correspondence
 * is true by construction rather than guessed. This is exactly why the
 * alignment table the seed needs does not exist for the library.
 *
 * Cuts fall only at sentence ends. German direct speech is quoted with
 * „…“ and »…«, and a cut inside one would strand an opening mark.
 */

/** Above this many words, a paragraph is cut. */
const MAX_WORDS = 110;

/** Aim for chunks around this size. */
const TARGET_WORDS = 75;

/** Never leave a chunk shorter than this; it is folded into its neighbour. */
const MIN_WORDS = 30;

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Split on sentence ends, keeping the punctuation and any closing quote with
 * the sentence it belongs to.
 */
export function sentences(paragraph: string): string[] {
  const parts = paragraph.split(/(?<=[.!?…][“»"']?)\s+(?=[„»"'A-ZÄÖÜ])/);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** One paragraph in, one or more flip-sized paragraphs out. */
export function splitParagraph(paragraph: string): string[] {
  if (words(paragraph) <= MAX_WORDS) return [paragraph];

  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences(paragraph)) {
    current.push(sentence);
    if (words(current.join(' ')) >= TARGET_WORDS) {
      chunks.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) chunks.push(current.join(' '));

  // A short tail reads as a mistake rather than a paragraph. Fold it back.
  if (chunks.length > 1 && words(chunks[chunks.length - 1]) < MIN_WORDS) {
    const tail = chunks.pop()!;
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${tail}`;
  }

  // A paragraph with no sentence breaks cannot be cut, and is left whole
  // rather than chopped mid-clause.
  return chunks.length > 0 ? chunks : [paragraph];
}

/** Every paragraph of a text, split. */
export function splitParagraphs(paragraphs: string[]): string[] {
  return paragraphs.flatMap(splitParagraph);
}
