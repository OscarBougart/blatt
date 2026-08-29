import type { LemmaCandidate } from '@/lib/lemma/types';

/** A German/English aligned pair — one paragraph of the source text. */
export interface Pair {
  de: string;
  en: string;
}

export interface Doc {
  id: string;
  title: string;
  /** Free-text tag, e.g. "Kurzgeschichte", "Nachrichten". */
  theme: string;
  pairs: Pair[];
  /** Populated at import by the lemma cascade. Surface form -> ranked lemmas. */
  lemmaMap: Record<string, LemmaCandidate[]>;
  /** Where the reader left off. */
  lastParagraphIndex: number;
  createdAt: number;
}

export interface SavedWord {
  id: string;
  /** As it appeared in the text. */
  surface: string;
  lemma: string;
  definition: string;
  /** The user's own note, used when lookup failed. */
  note?: string;
  /** Full source sentence. */
  sentence: string;
  /** Offset of the tapped occurrence within `sentence`. */
  charOffset: number;
  docId: string;
  paragraphIndex: number;
  createdAt: number;
  /** Dictionary lookup did not resolve. Retry when connectivity returns. */
  lookupFailed?: boolean;

  // SM-2
  ease: number;
  interval: number;
  repetitions: number;
  dueAt: number;
  lapses: number;
}

/** Permanent lookup cache. Never expires; the dictionary API is a fallback. */
export interface DictEntry {
  lemma: string;
  definitions: string[];
  fetchedAt: number;
  source: 'wiktionary' | 'manual';
}

export interface Session {
  id: string;
  docId: string;
  startedAt: number;
  endedAt?: number;
  /** German paragraphs that met the dwell threshold. */
  paragraphsViewed: number;
  /**
   * Unique paragraph indices that were current in the English view for at
   * least the dwell threshold. Flipping over and straight back does not count.
   */
  paragraphsFlipped: number;
  /** paragraphsFlipped / paragraphsViewed. Stored, not yet shown. */
  flipRate: number;
}

/**
 * Permanent cache of Wiktionary form lookups. This is the lemma table, and it
 * builds itself out of the words actually read.
 */
export interface FormEntry {
  surface: string;
  lemma: string | null;
  isLemma: boolean;
  fetchedAt: number;
}
