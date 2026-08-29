import type { FormLookup } from './cascade';

const BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

const UA = 'Blatt/0.1 (local-first German reading app; personal project)';

/**
 * Wiktionary wraps the lemma of a "form of" gloss in this span. Glossary links
 * (`/wiki/Appendix:Glossary#dative`) are grammatical labels, not lemmas, and
 * must be ignored — see docs/spikes.md, where mistaking one for the other cost
 * an afternoon.
 */
const FORM_LINK = /<span class="form-of-definition-link">([\s\S]*?)<\/span>/g;
const HREF = /href="\/wiki\/([^"]+)"/;

interface WiktionaryBlock {
  partOfSpeech: string;
  definitions: { definition: string }[];
}

function parseGerman(blocks: WiktionaryBlock[]): FormLookup {
  let lemma: string | null = null;
  let sawPlainSense = false;

  for (const block of blocks) {
    for (const { definition } of block.definitions ?? []) {
      if (!/form-of-definition/.test(definition)) {
        sawPlainSense = true;
        continue;
      }
      if (lemma) continue;

      for (const [, inner] of definition.matchAll(FORM_LINK)) {
        const href = HREF.exec(inner);
        if (!href) continue;
        const title = decodeURIComponent(href[1]).split('#')[0].replace(/_/g, ' ');
        if (title.includes(':') || /^Appendix/.test(title)) continue;
        lemma = title;
        break;
      }
    }
  }

  // A word can be both: `Namen` is a form of `Name`, `sein` is a lemma itself.
  return { lemma, isLemma: sawPlainSense };
}

async function fetchOne(surface: string, signal?: AbortSignal): Promise<FormLookup | null> {
  const response = await fetch(BASE + encodeURIComponent(surface), {
    headers: { 'Api-User-Agent': UA, Accept: 'application/json' },
    signal,
  });
  if (!response.ok) return null;

  const body = (await response.json()) as Record<string, WiktionaryBlock[]>;
  const german = body.de;
  return german ? parseGerman(german) : null;
}

/**
 * Look a surface form up, trying the exact form first and then a lowercased
 * retry.
 *
 * German capitalises nouns, so the exact form must win; but a sentence-initial
 * `Die` or `Wäre` only resolves lowercased. The spike measured this retry as
 * worth six points of coverage on real prose.
 */
export async function lookupForm(
  surface: string,
  signal?: AbortSignal,
): Promise<FormLookup | null> {
  const exact = await fetchOne(surface, signal);
  if (exact && (exact.lemma || exact.isLemma)) return exact;

  const lower = surface.charAt(0).toLowerCase() + surface.slice(1);
  if (lower === surface) return exact;

  return (await fetchOne(lower, signal)) ?? exact;
}
