/** German letters, including the ones a naive \w would drop. */
const WORD = /[A-Za-zÄÖÜäöüßẞ]+(?:[-'’][A-Za-zÄÖÜäöüßẞ]+)*/g;

/**
 * Pull word tokens out of a paragraph.
 *
 * Keeps internal hyphens (`Sonnen-Blume`) and apostrophes (`geht's`), drops
 * everything else. Case is preserved: German capitalises nouns, and the
 * distinction between `sie` and `Sie` is real, so lowercasing here would throw
 * away information the lemmatiser needs.
 */
export function tokenize(text: string): string[] {
  return text.match(WORD) ?? [];
}

/** Every distinct surface form in a document, in first-seen order. */
export function uniqueTokens(paragraphs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    for (const token of tokenize(paragraph)) {
      if (seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

/**
 * Split a paragraph into clauses.
 *
 * Separable-prefix reconstruction needs a boundary so it does not reach across
 * a comma into the next clause and grab an unrelated prefix. Commas, semicolons
 * and sentence ends are close enough; this is not a parser.
 */
export function clauses(sentence: string): string[] {
  return sentence
    .split(/[,;:.!?—–]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** The clause containing `surface`, or the whole sentence if it is not found. */
export function clauseContaining(sentence: string, surface: string): string {
  for (const clause of clauses(sentence)) {
    if (tokenize(clause).includes(surface)) return clause;
  }
  return sentence;
}
