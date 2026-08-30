/**
 * Turning an extracted article into the paragraphs Blatt reads.
 *
 * Readability hands back cleaned-up HTML; this decides what is prose and what
 * is furniture. Kept pure and separate from the DOM walking so the rules can
 * be argued with in a test rather than in a browser.
 */

/**
 * Below this a block is almost always a caption, a byline, a share prompt or a
 * cookie remnant rather than a paragraph of the article.
 *
 * It is a blunt rule and it will occasionally drop a real one-line paragraph.
 * That is the better error: a stray "Anzeige" in the middle of a text is read
 * as German prose, gets lemmatised, and quietly pollutes the sightings that
 * decide which words you already know.
 */
export const MIN_LENGTH = 40;

/** Lines that are furniture however long they are. */
const FURNITURE =
  /^(anzeige|werbung|newsletter|teilen|drucken|merken|kommentare?|quelle|foto|bild|©|weiterlesen|mehr zum thema|lesen sie auch|zur startseite)\b/i;

/** Collapse the whitespace that survives HTML extraction. */
export function tidy(text: string): string {
  return text
    .replace(/­/g, '') // soft hyphens, invisible and poisonous to matching
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keep the blocks that are actually the article.
 *
 * Order is preserved and nothing is merged: the index of a paragraph here
 * becomes the index of its translation, and that correspondence is the entire
 * reason this approach works.
 */
export function cleanBlocks(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const block of raw) {
    const text = tidy(block);
    if (text.length < MIN_LENGTH) continue;
    if (FURNITURE.test(text)) continue;

    // Repeated blocks are navigation or teasers that Readability let through.
    // A real article does not say the same forty characters twice.
    if (seen.has(text)) continue;

    seen.add(text);
    out.push(text);
  }

  return out;
}

/** A rough title, when the page gives nothing better. */
export function fallbackTitle(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const slug = pathname.split('/').filter(Boolean).pop() ?? '';
    const words = slug.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').trim();
    return words || hostname.replace(/^www\./, '');
  } catch {
    return 'Captured article';
  }
}
