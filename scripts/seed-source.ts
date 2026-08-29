/**
 * Where the demo text comes from, and how the two editions line up.
 *
 * Both sides are out of copyright: the Grimms' 1857 Kinder- und Hausmärchen,
 * and Margaret Hunt's 1884 translation. Neither is a modern edition, and
 * nothing here is paraphrased.
 *
 * The two texts do not agree on paragraph breaks — Hunt splits dialogue that
 * the German runs together — so the mapping is written out by hand rather than
 * guessed. Alignment is the one thing in this app that must not be
 * approximate: a flip that lands on the wrong paragraph is worse than no flip.
 */

export const DE_TITLE = 'Der Froschkönig oder der eiserne Heinrich (1857)';
export const EN_TITLE = "Grimm's Household Tales, Volume 1/The Frog-King, or Iron Henry";

export const TITLE = 'Der Froschkönig';
export const THEME = 'Märchen';

/**
 * English paragraphs to cut in two before aligning, at the sentence that opens
 * the second half. The German breaks in places Hunt does not.
 */
export const SPLITS: { paragraph: number; at: string }[] = [
  { paragraph: 11, at: 'when he fell down he was no frog' },
  { paragraph: 12, at: 'Again and once again' },
];

/**
 * One entry per paragraph of the finished document: which source paragraphs
 * make up the German side, and which make up the English.
 *
 * Indices on the English side refer to the list *after* SPLITS has been
 * applied, so 11 and 12 are the two halves of Hunt's long penultimate
 * paragraph.
 */
export const ALIGNMENT: { de: number[]; en: number[] }[] = [
  { de: [0], en: [0] },
  { de: [1], en: [1, 2, 3, 4] },
  { de: [2], en: [5] },
  { de: [3], en: [6, 7, 8] },
  { de: [4], en: [9] },
  { de: [5], en: [10, 11] },
  { de: [6, 7], en: [12, 13] },
  { de: [8], en: [14] },
];

/** How many words the demo arrives with already saved and due for review. */
export const SEED_WORD_COUNT = 6;
