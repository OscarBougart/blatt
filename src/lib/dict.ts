import { db } from '@/db/db';
import type { DictEntry } from '@/db/types';

const BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
const UA = 'Blatt/0.1 (local-first German reading app; personal project)';

/** More than this and the word list becomes a wall of text. */
const MAX_DEFINITIONS = 4;

interface Block {
  partOfSpeech?: string;
  definitions?: { definition: string }[];
}

/**
 * Wiktionary returns HTML in `definition`. It is never injected as markup —
 * it is stripped to text here and rendered as a string.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fetch English glosses for a German lemma. Throws if the network fails. */
export async function fetchDefinitions(lemma: string): Promise<string[]> {
  const response = await fetch(BASE + encodeURIComponent(lemma), {
    headers: { 'Api-User-Agent': UA, Accept: 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`wiktionary ${response.status}`);
  }

  const body = (await response.json()) as Record<string, Block[]>;
  const german = body.de;
  if (!german) return [];

  const out: string[] = [];
  for (const block of german) {
    for (const { definition } of block.definitions ?? []) {
      // "form of" glosses are grammar, not meaning — the lemma pass already
      // resolved those, so they add nothing here.
      if (/form-of-definition/.test(definition)) continue;
      const text = stripHtml(definition);
      if (!text) continue;
      const label = block.partOfSpeech ? `${block.partOfSpeech.toLowerCase()}: ` : '';
      out.push(label + text);
      if (out.length >= MAX_DEFINITIONS) return out;
    }
  }
  return out;
}

/**
 * Definition for a lemma, cache first, always.
 *
 * The cache is permanent and never evicted: a definition does not go stale,
 * and a word looked up once should never cost the network again.
 *
 * Returns null when the lookup failed — which is deliberately different from
 * an empty array, meaning "Wiktionary genuinely has nothing". A failure is
 * never cached, so it will be retried; an empty result is cached, so it is not.
 */
export async function lookupDefinition(lemma: string): Promise<DictEntry | null> {
  const cached = await db.dict.get(lemma);
  if (cached) return cached;

  let definitions: string[];
  try {
    definitions = await fetchDefinitions(lemma);
  } catch {
    return null;
  }

  const entry: DictEntry = {
    lemma,
    definitions,
    fetchedAt: Date.now(),
    source: 'wiktionary',
  };
  await db.dict.put(entry);
  return entry;
}

/** True when this lemma already has a cached definition. */
export async function isCached(lemma: string): Promise<boolean> {
  return (await db.dict.get(lemma)) !== undefined;
}
