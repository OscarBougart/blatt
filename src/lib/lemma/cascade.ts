import { lookupIrregular } from './irregulars';
import { separableCandidates, splitPrefix } from './separable';
import { stripParticiple, suffixCandidates } from './suffix';
import { rank, type LemmaCandidate } from './types';

/** What a Wiktionary lookup can tell us about one surface form. */
export interface FormLookup {
  /** The lemma this form inflects from, if the entry declares one. */
  lemma: string | null;
  /** True when a German entry exists and is itself a citation form. */
  isLemma: boolean;
}

export type FormResolver = (surface: string) => Promise<FormLookup | null>;

/** Any candidate at or above this is a real answer rather than a guess. */
export const CONFIDENT = 0.7;

/**
 * Stages 1, 3 and 4: everything that needs no network.
 *
 * Pure. Given the same surface and sentence it always returns the same ranked
 * list, which is what makes the whole thing testable.
 */
export function offlineCandidates(surface: string, sentence = ''): LemmaCandidate[] {
  const out: LemmaCandidate[] = [];

  // Stage 3a — the hand-written irregular table. Cheapest real answer there is.
  const irregular = lookupIrregular(surface);
  if (irregular) out.push({ lemma: irregular, confidence: 0.9, method: 'table' });

  // A separable participle: aufgestanden → auf + gestanden → auf + stehen.
  const split = splitPrefix(surface);
  if (split) {
    const innerIrregular = lookupIrregular(split.rest);
    if (innerIrregular) {
      out.push({ lemma: split.prefix + innerIrregular, confidence: 0.85, method: 'table' });
    }
    for (const participle of stripParticiple(split.rest)) {
      out.push({ lemma: split.prefix + participle, confidence: 0.6, method: 'suffix' });
    }
  }

  // Stage 3b — ordered suffix rules, umlaut reversal, participle circumfix.
  out.push(...suffixCandidates(surface));

  // Stage 4 — a stranded separable prefix later in the same clause.
  const verbLemma =
    irregular ?? out.find((c) => c.method === 'suffix' && c.lemma.endsWith('en'))?.lemma;
  if (verbLemma) out.push(...separableCandidates(surface, verbLemma, sentence));

  // Last resort, so a tapped word always offers something to look up.
  out.push({ lemma: surface, confidence: 0.25, method: 'exact' });

  return rank(out);
}

/**
 * The full cascade, cheapest stage first.
 *
 * Stage 2 (Wiktionary) is injected rather than imported so the cascade stays
 * pure and testable, and so a network failure degrades to the offline stages
 * instead of throwing.
 */
export async function lemmatize(
  surface: string,
  options: { sentence?: string; resolveForm?: FormResolver } = {},
): Promise<LemmaCandidate[]> {
  const { sentence = '', resolveForm } = options;
  const offline = offlineCandidates(surface, sentence);

  if (!resolveForm) return offline;

  let lookup: FormLookup | null = null;
  try {
    lookup = await resolveForm(surface);
  } catch {
    // Offline, rate-limited, or the endpoint changed. The offline stages stand.
    return offline;
  }

  const out = [...offline];

  if (lookup?.lemma) {
    out.push({ lemma: lookup.lemma, confidence: 0.95, method: 'wiktionary' });
  }
  if (lookup?.isLemma) {
    // The word is already a citation form. That is the strongest answer there is.
    out.push({ lemma: surface, confidence: 1, method: 'exact' });
  }

  return rank(out);
}

/** Did the cascade actually resolve this form, or only guess at it? */
export function isResolved(candidates: LemmaCandidate[]): boolean {
  return candidates.some((c) => c.confidence >= CONFIDENT);
}
