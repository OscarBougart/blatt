import { db } from '@/db/db';
import type { CardMode, SavedWord } from '@/db/types';
import { buildFamiliarity } from './familiarity';
import { bestAlternative, findOccurrences, type Occurrence } from './sentencePick';

/**
 * Rebuilding a card from a better sentence.
 *
 * This is the feature Anki structurally cannot have. Rerolling needs every
 * sentence you have read, lemmatised, with its translation aligned — which is
 * a corpus, and Anki has a pile of cards instead. Here the reader and the
 * review system are the same store, so the alternative sentence and its
 * English come back together, for one tap.
 *
 * It is also the documented remedy for a leech: the received wisdom on a card
 * failed six times is that the card is wrong, not the memory, and that the fix
 * is to rebuild it from different context.
 */

/** Scan the corpus for a better sentence than the one this card is using. */
export async function findBetterSentence(word: SavedWord): Promise<Occurrence | null> {
  const [docs, words, sightings, logs] = await Promise.all([
    db.docs.toArray(),
    db.words.toArray(),
    db.sightings.toArray(),
    db.reviews.toArray(),
  ]);

  const isFamiliar = buildFamiliarity({ words, sightings, logs }, Date.now());
  const occurrences = findOccurrences(docs, word.lemma, isFamiliar);

  return bestAlternative(occurrences, {
    sentence: word.sentence,
    score: word.sentenceScore,
  });
}

/**
 * Move a card onto another sentence.
 *
 * The document and paragraph move with it, because the English side is found
 * by those two numbers — a card rebuilt from another text without them would
 * show the translation of a paragraph it is no longer quoting.
 *
 * A reroll also lifts a suspension. Being rebuilt is exactly what a suspended
 * leech was waiting for; leaving it suspended afterwards would make the remedy
 * pointless.
 */
export async function applySentence(word: SavedWord, next: Occurrence): Promise<void> {
  await db.words.update(word.id, {
    sentence: next.sentence,
    charOffset: next.charOffset,
    docId: next.docId,
    paragraphIndex: next.paragraphIndex,
    sentenceScore: next.score,
    suspended: false,
  });
}

export async function setCardMode(word: SavedWord, mode: CardMode): Promise<void> {
  await db.words.update(word.id, { cardMode: mode });
}
