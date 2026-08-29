import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isResolved, lemmatize, type FormLookup } from '../src/lib/lemma/cascade';
import { tokenize, uniqueTokens } from '../src/lib/lemma/tokenize';

/**
 * Measure the cascade against a real story, over the live network.
 *
 * Run by hand:  npm run measure
 *
 * The text is a Grimm fairy tale from German Wikisource — first published in
 * the 1800s and long in the public domain. Nothing of it is written out here
 * beyond individual word tokens.
 *
 * Both caches are on disk, so a re-run costs Wikimedia nothing for words it
 * has already answered. Be patient rather than parallel: an earlier version of
 * this script fired six concurrent requests, got rate-limited, and produced a
 * confident and completely wrong 27% coverage figure.
 */

const TITLE = 'Der Froschkönig oder der eiserne Heinrich (1857)';
const STORY_CACHE = 'scripts/.story-cache.txt';
const FORM_CACHE = 'scripts/.form-cache.json';
const UA = 'Blatt/0.1 lemma measurement (personal project)';

const BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
const FORM_LINK = /<span class="form-of-definition-link">([\s\S]*?)<\/span>/g;
const HREF = /href="\/wiki\/([^"]+)"/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchStory(title: string): Promise<string> {
  if (existsSync(STORY_CACHE)) return readFileSync(STORY_CACHE, 'utf8');

  const url =
    'https://de.wikisource.org/api/rest_v1/page/html/' + encodeURIComponent(title);
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`wikisource ${response.status}`);
  const html = await response.text();

  const body = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, '')
    .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, '');

  const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, inner]) =>
      inner
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 40);

  const text = paragraphs.join('\n\n');

  // Wikimedia serves Varnish error pages with HTTP 200 and English prose in
  // them. Check this is German before trusting any number derived from it.
  const markers = (text.match(/\b(der|die|das|und|nicht|sich|ihm|war)\b/gi) ?? []).length;
  if (markers < 20) throw new Error(`not German prose (${markers} markers) — error page?`);

  writeFileSync(STORY_CACHE, text, 'utf8');
  return text;
}

type Outcome =
  | { kind: 'ok'; value: FormLookup }
  | { kind: 'absent' } // Wiktionary has no German entry — a real answer
  | { kind: 'failed' }; // network or rate limit — NOT an answer

function parseGerman(blocks: { definitions: { definition: string }[] }[]): FormLookup {
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
  return { lemma, isLemma: sawPlainSense };
}

async function fetchForm(word: string): Promise<Outcome> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(BASE + encodeURIComponent(word), {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });
      if (response.status === 404) return { kind: 'absent' };
      if (response.status === 429 || response.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) return { kind: 'failed' };

      const body = (await response.json()) as Record<
        string,
        { definitions: { definition: string }[] }[]
      >;
      return body.de ? { kind: 'ok', value: parseGerman(body.de) } : { kind: 'absent' };
    } catch {
      await sleep(1000 * 2 ** attempt);
    }
  }
  return { kind: 'failed' };
}

describe('lemma cascade on a real story', () => {
  it('reports coverage', async () => {
    const text = await fetchStory(TITLE);
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
    const tokens = uniqueTokens(paragraphs);

    const sentences = new Map<string, string>();
    for (const paragraph of paragraphs) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        for (const token of tokenize(sentence)) {
          if (!sentences.has(token)) sentences.set(token, sentence);
        }
      }
    }

    // OFFLINE=1 measures stages 3 and 4 alone — no network at all. That is the
    // honest floor: what the engine can do for a document imported with no
    // connection, or when Wikimedia is refusing us.
    const offlineOnly = process.env.OFFLINE === '1';

    const cache: Record<string, FormLookup | null> = existsSync(FORM_CACHE)
      ? JSON.parse(readFileSync(FORM_CACHE, 'utf8'))
      : {};
    let failures = 0;

    const results = new Map<string, Awaited<ReturnType<typeof lemmatize>>>();

    // Strictly serial. 488 words is a couple of minutes; a wrong number is
    // worth much more than that.
    for (const surface of tokens) {
      const resolveForm = async (word: string) => {
        if (word in cache) return cache[word];

        const exact = await fetchForm(word);
        let outcome = exact;

        // Sentence-initial capitals only resolve lowercased.
        const lower = word.charAt(0).toLowerCase() + word.slice(1);
        const unresolved =
          exact.kind !== 'ok' || (!exact.value.lemma && !exact.value.isLemma);
        if (unresolved && lower !== word) {
          await sleep(120);
          const retry = await fetchForm(lower);
          if (retry.kind === 'ok') outcome = retry;
        }

        if (outcome.kind === 'failed') {
          failures++;
          throw new Error('lookup failed'); // the cascade degrades to offline
        }
        const value = outcome.kind === 'ok' ? outcome.value : null;
        cache[word] = value;
        return value;
      };

      results.set(
        surface,
        await lemmatize(surface, {
          sentence: sentences.get(surface) ?? '',
          resolveForm: offlineOnly ? undefined : resolveForm,
        }),
      );
      if (!offlineOnly) await sleep(120);
    }

    writeFileSync(FORM_CACHE, JSON.stringify(cache), 'utf8');

    const resolved: string[] = [];
    const failed: string[] = [];
    const byMethod = new Map<string, number>();

    for (const [surface, candidates] of results) {
      if (isResolved(candidates)) {
        resolved.push(surface);
        const method = candidates[0].method;
        byMethod.set(method, (byMethod.get(method) ?? 0) + 1);
      } else {
        failed.push(surface);
      }
    }

    const total = tokens.length;
    const pct = (n: number) => `${((100 * n) / total).toFixed(1)}%`;
    const lines: string[] = [];

    lines.push(`Story: ${TITLE}`);
    lines.push(`Mode: ${offlineOnly ? 'OFFLINE ONLY (stages 3-4)' : 'full cascade'}`);
    lines.push(`Paragraphs: ${paragraphs.length}`);
    lines.push(`Unique surface forms: ${total}`);
    lines.push(`Resolved:   ${resolved.length} (${pct(resolved.length)})`);
    lines.push(`Unresolved: ${failed.length} (${pct(failed.length)})`);
    lines.push(`Network lookups that FAILED (not counted as answers): ${failures}`);
    lines.push('', 'Top candidate by method:');
    for (const [method, n] of [...byMethod].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${method.padEnd(12)} ${n}`);
    }

    lines.push('', 'Sample of 20 unresolved forms (best guesses shown):');
    for (const surface of failed.slice(0, 20)) {
      const best = results.get(surface)!.slice(0, 3);
      lines.push(
        `  ${surface.padEnd(20)} ${best
          .map((c) => `${c.lemma} (${c.confidence.toFixed(2)} ${c.method})`)
          .join(', ')}`,
      );
    }

    lines.push('', 'Spot check — 25 resolved forms:');
    for (const surface of resolved.slice(0, 25)) {
      const best = results.get(surface)![0];
      lines.push(
        `  ${surface.padEnd(20)} -> ${best.lemma.padEnd(16)} (${best.confidence.toFixed(2)} ${best.method})`,
      );
    }

    const report = lines.join('\n');
    writeFileSync('lemma-report.txt', report, 'utf8');

    // A run with many network failures is not a measurement of the cascade.
    expect(failures / total).toBeLessThan(0.1);
  }, 3_600_000);
});
