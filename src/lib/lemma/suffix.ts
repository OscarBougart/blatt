import type { LemmaCandidate } from './types';

/** Shortest stem a rule may leave behind, to stop `See` becoming `S`. */
const MIN_STEM = 3;

interface Rule {
  /** Inflectional ending to remove. */
  suffix: string;
  /** What to put back to reach the citation form. */
  append: string;
  confidence: number;
}

/**
 * Ordered German inflectional suffix rules, longest ending first so that
 * `-ern` is tried before `-er` and `-en` before `-n`.
 *
 * Confidences are ordering hints, not probabilities: verb endings that could
 * also be noun endings score lower because they are more often wrong.
 */
const RULES: readonly Rule[] = [
  // verbs -> infinitive
  { suffix: 'test', append: 'en', confidence: 0.55 },
  { suffix: 'tet', append: 'en', confidence: 0.5 },
  { suffix: 'ten', append: 'en', confidence: 0.5 },
  { suffix: 'est', append: 'en', confidence: 0.5 },
  { suffix: 'st', append: 'en', confidence: 0.5 },
  { suffix: 'te', append: 'en', confidence: 0.5 },
  { suffix: 'et', append: 'en', confidence: 0.45 },
  { suffix: 't', append: 'en', confidence: 0.45 },

  // nouns and adjectives -> citation form
  { suffix: 'nen', append: '', confidence: 0.5 },
  { suffix: 'ern', append: '', confidence: 0.5 },
  { suffix: 'en', append: '', confidence: 0.5 },
  { suffix: 'em', append: '', confidence: 0.5 },
  { suffix: 'es', append: '', confidence: 0.5 },
  { suffix: 'er', append: '', confidence: 0.45 },
  { suffix: 'e', append: '', confidence: 0.45 },
  { suffix: 'n', append: '', confidence: 0.4 },
  { suffix: 's', append: '', confidence: 0.4 },

  // adjective superlatives
  { suffix: 'sten', append: '', confidence: 0.4 },
  { suffix: 'ste', append: '', confidence: 0.4 },
];

const UMLAUTS: Record<string, string> = { 'ä': 'a', 'ö': 'o', 'ü': 'u' };

/**
 * Reverse an umlaut, as German plurals and comparatives add one.
 *
 * `Häusern` -> `Haus`, `Bäume` -> `Baum`. Only the first umlaut is reversed:
 * words with two are vanishingly rare and reversing both invents non-words.
 */
export function reverseUmlaut(word: string): string | null {
  const au = word.replace(/äu/, 'au');
  if (au !== word) return au;
  const single = word.replace(/[äöü]/, (c) => UMLAUTS[c]);
  return single === word ? null : single;
}

/**
 * Put back the schwa that inflection drops.
 *
 * German adjectives ending in -el and -er lose the `e` when they take an
 * ending: `dunkel` -> `dunkler`, `teuer` -> `teure`, `edel` -> `edles`.
 * Stripping the ending leaves `dunkl`, which is not a word; the `e` has to be
 * restored.
 */
export function restoreSchwa(stem: string): string | null {
  const match = /^(.*[^aeiouäöü])([lr])$/.exec(stem);
  return match ? `${match[1]}e${match[2]}` : null;
}

/**
 * Strip the `ge-...-t` / `ge-...-en` circumfix off a participle.
 *
 * `gemacht` -> `machen`. Strong participles change their stem vowel
 * (`gesprochen` -> `sprechen`), which no rule can recover — those are caught
 * by the irregular table first.
 */
export function stripParticiple(word: string): string[] {
  const lower = word.toLowerCase();
  const out: string[] = [];

  const match = /^(.*?)ge(.+?)(t|en)$/.exec(lower);
  if (!match) return out;

  const [, prefix, stem, ending] = match;
  if (stem.length < MIN_STEM) return out;

  out.push(prefix + stem + 'en');
  if (ending === 't') out.push(prefix + stem + 'n');
  return out;
}

/**
 * Offline suffix-stripping candidates for one surface form.
 *
 * Every rule that matches produces a candidate; nothing is chosen here. Being
 * generous is fine because the caller ranks, and the Wiktionary stage outranks
 * all of this when it is available.
 */
export function suffixCandidates(surface: string): LemmaCandidate[] {
  const out: LemmaCandidate[] = [];
  const isCapitalised = /^[A-ZÄÖÜ]/.test(surface);
  const word = surface.toLowerCase();

  const push = (lemma: string, confidence: number) => {
    if (lemma.length < MIN_STEM) return;
    // German nouns keep their capital; verbs and adjectives do not.
    out.push({
      lemma: isCapitalised ? lemma.charAt(0).toUpperCase() + lemma.slice(1) : lemma,
      confidence,
      method: 'suffix',
    });
  };

  for (const rule of RULES) {
    if (!word.endsWith(rule.suffix)) continue;
    const stem = word.slice(0, -rule.suffix.length);
    if (stem.length < MIN_STEM) continue;

    push(stem + rule.append, rule.confidence);

    // Plurals and comparatives umlaut the stem; undo it and offer both.
    const plain = reverseUmlaut(stem);
    if (plain) push(plain + rule.append, rule.confidence - 0.05);

    // dunkler -> dunkl -> dunkel
    if (rule.append === '') {
      const schwa = restoreSchwa(stem);
      if (schwa) push(schwa, rule.confidence - 0.05);
      if (plain) {
        const plainSchwa = restoreSchwa(plain);
        if (plainSchwa) push(plainSchwa, rule.confidence - 0.1);
      }
    }
  }

  for (const participle of stripParticiple(word)) {
    out.push({ lemma: participle, confidence: 0.6, method: 'suffix' });
  }

  // The bare umlaut reversal, for plurals with no ending at all: Väter -> Vater.
  const bare = reverseUmlaut(word);
  if (bare) push(bare, 0.4);

  return out;
}
