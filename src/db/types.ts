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

export type CardMode = 'recognition' | 'cloze';

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

  /**
   * When this word first entered review. A saved word is not a card until
   * this is set — until then it waits in the queue, so that an evening of
   * enthusiastic tapping cannot flood next week.
   */
  introducedAt?: number;
  /** Suspended cards are never scheduled. Set when a word becomes a leech. */
  suspended?: boolean;
  /**
   * Recognition shows the sentence and asks what the word means; cloze blanks
   * the word and asks you to produce it.
   *
   * Recognition is the default because this is a reading app: it carries the
   * bulk of vocabulary and lets you consume more, with production reserved for
   * the words you actually intend to say.
   */
  cardMode?: CardMode;
  /**
   * How many unfamiliar words stood between this sentence and being an ideal
   * card, when it was saved. Zero is i+1: the target and nothing else new.
   */
  sentenceScore?: number;
  /** When this word crossed the lapse threshold. */
  leechFlaggedAt?: number;
}

/**
 * One row per grade press, without exception.
 *
 * Two things need this and neither works retroactively. FSRS — the algorithm
 * that replaced SM-2 as Anki's default — trains on review history, so if
 * Blatt ever changes scheduler this log is the difference between keeping
 * years of data and starting again from nothing. Leech detection needs it to
 * tell a card that is hard from a card that is broken.
 */
export interface ReviewLog {
  id: string;
  wordId: string;
  reviewedAt: number;
  /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
  grade: 1 | 2 | 3 | 4;
  /** The interval the card was carrying when it was shown, in days. */
  intervalBefore: number;
  easeBefore: number;
  /** Days actually elapsed since the last review, which is rarely the plan. */
  elapsedDays: number;
  /** Card shown to grade pressed. */
  durationMs: number;
}

/**
 * How often a lemma has been read past without being tapped.
 *
 * Counted once per paragraph that met the dwell threshold, not once per
 * occurrence: reading a paragraph containing "Frosch" four times is one
 * sighting, because it is one act of reading.
 */
export interface Sighting {
  lemma: string;
  count: number;
  lastSeenAt: number;
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
