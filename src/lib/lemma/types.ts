export type LemmaMethod =
  | 'exact'
  | 'wiktionary'
  | 'suffix'
  | 'separable'
  | 'table'
  | 'manual';

export interface LemmaCandidate {
  lemma: string;
  /** 0–1. Ordering, not probability: higher means "trust this one first". */
  confidence: number;
  method: LemmaMethod;
}

/**
 * Merge candidates, keeping the best confidence per lemma, ranked.
 *
 * The cascade deliberately returns a list. German morphology is ambiguous —
 * `Bauer` is a farmer or a birdcage, `sein` is "to be" or "his" — and a ranked
 * list lets the reader pick. A single confident wrong answer is worse than
 * three ranked guesses.
 */
export function rank(candidates: LemmaCandidate[]): LemmaCandidate[] {
  const best = new Map<string, LemmaCandidate>();

  for (const candidate of candidates) {
    if (!candidate.lemma) continue;
    const existing = best.get(candidate.lemma);
    if (!existing || candidate.confidence > existing.confidence) {
      best.set(candidate.lemma, candidate);
    }
  }

  return [...best.values()].sort(
    (a, b) => b.confidence - a.confidence || a.lemma.localeCompare(b.lemma, 'de'),
  );
}
