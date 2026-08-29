import type { LemmaCandidate } from './types';
import { clauseContaining, tokenize } from './tokenize';

/**
 * Separable prefixes, longest first so `zurück` is matched before `zu`.
 *
 * The list from the spec, ordered for matching.
 */
export const SEPARABLE_PREFIXES = [
  'zurück', 'nach', 'mit', 'aus', 'bei', 'ein', 'vor', 'weg', 'her', 'hin',
  'auf', 'ab', 'an', 'zu',
] as const;

const PREFIX_SET = new Set<string>(SEPARABLE_PREFIXES);

/** Prefixes that are usually an article or preposition instead. */
const ARTICLE_LIKE = new Set(['ein', 'an', 'zu', 'bei', 'mit', 'nach', 'vor', 'aus']);

/**
 * Reconstruct a separable verb from a finite verb and a stranded prefix.
 *
 * In `er steht früh auf`, the prefix sits at the end of the clause and the
 * lemma is `aufstehen`, not `stehen`. This scans the rest of the clause for a
 * known prefix and offers the joined form as a candidate.
 *
 * Deliberately shallow. It does not parse clause structure, so it will
 * sometimes join a prefix that is really a preposition — `er ging mit dem Hund`
 * yields a candidate `mitgehen` alongside `gehen`. That is why this returns a
 * ranked candidate rather than an answer, and why it scores below Wiktionary.
 *
 * @param surface   the finite verb as it appeared
 * @param verbLemma the lemma already worked out for that verb (`steht` → `stehen`)
 * @param sentence  the sentence the verb appeared in
 */
export function separableCandidates(
  surface: string,
  verbLemma: string,
  sentence: string,
): LemmaCandidate[] {
  if (!sentence || !verbLemma) return [];

  const clause = clauseContaining(sentence, surface);
  const tokens = tokenize(clause);
  const verbAt = tokens.indexOf(surface);
  if (verbAt === -1) return [];

  const out: LemmaCandidate[] = [];

  // Only look *after* the verb: a prefix before it belongs to another clause
  // or is a genuine preposition governing something else.
  for (let i = verbAt + 1; i < tokens.length; i++) {
    const candidate = tokens[i].toLowerCase();
    if (!PREFIX_SET.has(candidate)) continue;

    // `ein`, `an` and `zu` are far more often an article or preposition than a
    // stranded prefix, and a following capitalised word means a noun phrase is
    // starting: "lebte ein König" is not the verb `einleben`. This one rule
    // removes the most common false positive by a wide margin.
    const next = tokens[i + 1];
    if (ARTICLE_LIKE.has(candidate) && next && /^[A-ZÄÖÜ]/.test(next)) continue;

    // The further from the verb, the less likely it is really its prefix.
    // Kept below the plain suffix candidate (0.50) on purpose: a separable
    // reading must never outrank the simple verb it was built from.
    const distance = i - verbAt;
    out.push({
      lemma: candidate + verbLemma.toLowerCase(),
      confidence: distance <= 3 ? 0.48 : 0.42,
      method: 'separable',
    });
  }

  return out;
}

/**
 * Split an already-joined separable verb: `aufstehen` → prefix `auf`, rest
 * `stehen`. Used to recognise participles like `aufgestanden`.
 */
export function splitPrefix(word: string): { prefix: string; rest: string } | null {
  const lower = word.toLowerCase();
  for (const prefix of SEPARABLE_PREFIXES) {
    if (lower.startsWith(prefix) && lower.length - prefix.length >= 3) {
      return { prefix, rest: lower.slice(prefix.length) };
    }
  }
  return null;
}
