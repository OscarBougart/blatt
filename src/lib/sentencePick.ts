import type { Doc } from '@/db/types';
import { tokenize } from './lemma/tokenize';
import { sentencesOf } from './segment';

/**
 * Choosing the sentence a card is built from.
 *
 * The rule sentence-mining rests on is that a good card has exactly one
 * unknown word. With three or four you stop learning the language and start
 * memorising the shape of the card. Anki users judge this by eye, one card at
 * a time, and it is the single most tedious part of the method.
 *
 * Blatt can compute it, because the reader and the review system share one
 * corpus: every sentence you have read is already here, already lemmatised,
 * and already aligned to its translation. That is the whole architectural
 * argument for this app, and this file is where it pays off.
 */

/** Below this a sentence carries no context worth learning from. */
export const MIN_WORDS = 6;

/** Above this it carries too much, and the target gets lost in it. */
export const MAX_WORDS = 18;

/** Added per word outside the range. Mild: length is a nudge, not a veto. */
export const LENGTH_PENALTY = 0.25;

export interface ScoreOptions {
  /** Resolves a surface form to its lemma. Usually a document's own map. */
  lemmaOf: (surface: string) => string;
  /** Epic 9's familiarity model. */
  isFamiliar: (lemma: string) => boolean;
}

/**
 * How far this sentence is from being an ideal card for `targetLemma`.
 *
 * The count of lemmas that are neither the target nor already familiar, plus
 * a mild penalty for length. Lower is better; 0 is i+1 — the target is the
 * only thing in the sentence you do not already know.
 */
export function scoreSentence(
  sentence: string,
  targetLemma: string,
  { lemmaOf, isFamiliar }: ScoreOptions,
): number {
  const surfaces = tokenize(sentence);

  // Counted per distinct lemma: a sentence that repeats one unknown word is
  // carrying one unknown word, not three.
  const unknown = new Set<string>();
  for (const surface of surfaces) {
    const lemma = lemmaOf(surface);
    if (lemma === targetLemma) continue;
    if (isFamiliar(lemma)) continue;
    unknown.add(lemma);
  }

  const words = surfaces.length;
  const overflow =
    words < MIN_WORDS ? MIN_WORDS - words : words > MAX_WORDS ? words - MAX_WORDS : 0;

  return unknown.size + overflow * LENGTH_PENALTY;
}

export interface Occurrence {
  sentence: string;
  /** Offset of the target within `sentence`. */
  charOffset: number;
  docId: string;
  paragraphIndex: number;
  score: number;
}

/** A document's surface→lemma resolver, falling back to the surface form. */
export function resolverFor(doc: Doc): (surface: string) => string {
  return (surface) => doc.lemmaMap?.[surface]?.[0]?.lemma ?? surface;
}

/**
 * Every sentence in the corpus containing `targetLemma`, best first.
 *
 * Scanned on demand rather than kept as a persistent index. Documents are
 * short — a few hundred sentences — and an index would be a second source of
 * truth to keep correct through every import and every correction. Ship, then
 * earn the complexity.
 */
export function findOccurrences(
  docs: Doc[],
  targetLemma: string,
  isFamiliar: (lemma: string) => boolean,
): Occurrence[] {
  const out: Occurrence[] = [];

  for (const doc of docs) {
    const lemmaOf = resolverFor(doc);

    doc.pairs.forEach((pair, paragraphIndex) => {
      for (const sentence of sentencesOf(pair.de)) {
        // Find the target's own position, so the card can mark the right word.
        let charOffset = -1;
        for (const match of sentence.text.matchAll(/[A-Za-zÄÖÜäöüßẞ]+/g)) {
          if (lemmaOf(match[0]) === targetLemma) {
            charOffset = match.index;
            break;
          }
        }
        if (charOffset < 0) continue;

        out.push({
          sentence: sentence.text,
          charOffset,
          docId: doc.id,
          paragraphIndex,
          score: scoreSentence(sentence.text, targetLemma, { lemmaOf, isFamiliar }),
        });
      }
    });
  }

  // Ties broken by the shorter sentence: same load, less to read.
  return out.sort((a, b) => a.score - b.score || a.sentence.length - b.sentence.length);
}

/**
 * The best alternative to the sentence a card is using now.
 *
 * Strictly better, not merely different. Offering a swap that does not improve
 * the card wastes the one tap this feature is worth.
 */
export function bestAlternative(
  occurrences: Occurrence[],
  current: { sentence: string; score?: number },
): Occurrence | null {
  const currentScore =
    current.score ?? occurrences.find((o) => o.sentence === current.sentence)?.score ?? Infinity;

  for (const occurrence of occurrences) {
    if (occurrence.sentence === current.sentence) continue;
    if (occurrence.score < currentScore) return occurrence;
  }
  return null;
}
