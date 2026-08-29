import type { Pair } from '@/db/types';

export interface PairResult {
  pairs: Pair[];
  deCount: number;
  enCount: number;
  /** True when the two sides produced different paragraph counts. */
  mismatch: boolean;
}

/**
 * Split a pasted text into paragraphs on blank lines.
 *
 * A "blank line" tolerates trailing whitespace and either line ending, because
 * text pasted out of a browser or a PDF rarely has clean \n\n.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Zip German and English paragraphs index by index.
 *
 * If the sides disagree, the shorter one is padded with empty strings rather
 * than truncating the longer. Losing the tail of a text silently would be worse
 * than showing a gap the reader can see and fix.
 */
export function pairParagraphs(de: string, en: string): PairResult {
  const deParas = splitParagraphs(de);
  const enParas = splitParagraphs(en);
  const length = Math.max(deParas.length, enParas.length);

  const pairs: Pair[] = Array.from({ length }, (_, i) => ({
    de: deParas[i] ?? '',
    en: enParas[i] ?? '',
  }));

  return {
    pairs,
    deCount: deParas.length,
    enCount: enParas.length,
    mismatch: deParas.length !== enParas.length,
  };
}
