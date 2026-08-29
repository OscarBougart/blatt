const UA = 'Blatt/0.1 (German reading PWA, personal project; oscar.bougart.dev@gmail.com)';
const BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

export async function def(word) {
  const res = await fetch(BASE + encodeURIComponent(word), {
    headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return { status: res.status, de: null };
  const body = await res.json();
  return { status: 200, de: body.de ?? null, langs: Object.keys(body) };
}

const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * Does this German entry point at a lemma? Returns the lemma page title, or null.
 *
 * Wiktionary wraps the lemma of a "form of" gloss in
 * `<span class="form-of-definition-link">` containing an `<a href="/wiki/X#German">`.
 * That span is the reliable signal; glossary links (Appendix:Glossary#dative etc.)
 * are grammatical labels and must be ignored.
 */
export function lemmaPointer(deEntry) {
  if (!deEntry) return null;
  for (const block of deEntry) {
    for (const d of block.definitions ?? []) {
      const html = d.definition;
      if (!/form-of-definition/.test(html)) continue;
      const spans = [...html.matchAll(/<span class="form-of-definition-link">([\s\S]*?)<\/span>/g)];
      for (const [, inner] of spans) {
        const m = inner.match(/href="\/wiki\/([^"]+)"/);
        if (!m) continue;
        const title = decodeURIComponent(m[1]).split('#')[0].replace(/_/g, ' ');
        if (!title.includes(':') && !/^Appendix/.test(title)) return title;
      }
    }
  }
  return null;
}

export { strip };
