/**
 * The parts of a build script that talk to the outside world.
 *
 * Shared by build-seed and build-library, which do the same three things —
 * pull prose off Wikisource, lemmatise it, look every lemma up — and must do
 * them identically. When this lived in build-seed alone, the library build
 * would have been a second copy of the politeness rules, and the copy that
 * gets a fix is never the one that gets run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { FormLookup, FormResolver } from '@/lib/lemma/cascade';
import { lookupForm } from '@/lib/lemma/wiktionary';

export const UA = 'Blatt/0.1 (local-first German reading app; personal project)';

/** Wikimedia rate-limits this hard enough to matter. Be patient, not clever. */
export const CONCURRENCY = 4;

/** How often the on-disk caches are flushed, in items. */
export const FLUSH_EVERY = 25;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Every request out of a build script goes through here.
 *
 * Two things the browser gives the app for free and Node does not. First a
 * real `User-Agent`: Wikimedia answers 429 to anything without one, which the
 * app code reads as "no such word" and quietly degrades — the first run of the
 * seed script produced a file with five definitions in it before that was
 * understood. Second, one request at a time with a gap, and a real backoff
 * when the rate limiter does object.
 *
 * Patching the global keeps the app's own fetch calls untouched: the lemma
 * cascade and the dictionary are exactly the code that runs in the browser,
 * which is the point — the shipped map must be the map a reader would have
 * built themselves.
 */
export function politeFetch(gapMs = 250) {
  const real = globalThis.fetch;
  let queue: Promise<unknown> = Promise.resolve();

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const run = async () => {
      for (let attempt = 0; attempt < 9; attempt++) {
        const response = await real(input, {
          ...init,
          headers: { ...(init?.headers as Record<string, string>), 'User-Agent': UA },
        });
        if (response.status !== 429 && response.status !== 503) return response;
        await sleep(1000 * 2 ** attempt);
      }
      return real(input, init);
    };

    const mine = queue.then(run);
    queue = mine.then(() => sleep(gapMs), () => sleep(gapMs));
    return mine;
  }) as typeof fetch;

  return () => {
    globalThis.fetch = real;
  };
}

/** A directory of JSON caches, so a re-run costs Wikimedia nothing. */
export function diskCache(dir: string) {
  return {
    read<T>(name: string, fallback: T): T {
      const path = `${dir}/${name}`;
      if (!existsSync(path)) return fallback;
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    },
    write(name: string, value: unknown) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/${name}`, JSON.stringify(value), 'utf8');
    },
  };
}

export type DiskCache = ReturnType<typeof diskCache>;

/**
 * How short a block may be and still count as prose.
 *
 * The seed was built at 40, which is safe for narration and wrong for
 * dialogue: it silently deleted „Heißest du Rumpelstilzchen?“ — the line the
 * entire tale turns on — along with the page furniture it was aimed at. The
 * library uses a low bound and leans on the letter test instead.
 *
 * The default stays 40 so that build-seed keeps producing the same paragraph
 * list. Its alignment table is written by hand against those indices, and a
 * block appearing or vanishing would silently shift every pairing after it.
 */
export const PROSE_MIN = 40;
export const DIALOGUE_MIN = 10;

/**
 * Strip a Wikisource HTML page down to its prose paragraphs.
 *
 * Page markers — the `[282]` a scan leaves where a page turned — are removed
 * wherever they fall. They were being shipped inside the German, mid-sentence,
 * in every text including the demo.
 */
export function paragraphsFrom(html: string, minLength = PROSE_MIN): string[] {
  const body = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, '')
    .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, '');

  return [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, inner]) =>
      inner
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        // Wikisource carries soft hyphens and page-join zero-width spaces.
        .replace(/[­​]/g, '')
        // The page number a scan leaves behind where a page turned.
        .replace(/\[\d+\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    // A block with no letters in it is furniture, whatever its length.
    .filter((p) => p.length >= minLength && /\p{L}/u.test(p));
}

/** One Wikisource page, as paragraphs, cached on disk under `cacheName`. */
export async function fetchPage(
  host: string,
  title: string,
  cacheName: string,
  cache: DiskCache,
  minLength = PROSE_MIN,
): Promise<string[]> {
  const hit = cache.read<string[] | null>(cacheName, null);
  if (hit) return hit;

  const url = `https://${host}/api/rest_v1/page/html/${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (response.status === 429) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`${host} ${response.status} for "${title}"`);
    const paragraphs = paragraphsFrom(await response.text(), minLength);
    cache.write(cacheName, paragraphs);
    return paragraphs;
  }
  throw new Error(`${host} rate-limited on "${title}"`);
}

/** Run `worker` over `items`, a few at a time. */
export async function pool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = CONCURRENCY,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
}

/** A resolver backed by a disk cache, standing in for the app's Dexie one. */
export function diskResolver(cache: DiskCache): { resolve: FormResolver; save: () => void } {
  const forms = cache.read<Record<string, FormLookup | null>>('forms.json', {});
  let since = 0;
  const save = () => cache.write('forms.json', forms);

  return {
    resolve: async (surface) => {
      if (surface in forms) return forms[surface];
      const looked = await lookupForm(surface);
      forms[surface] = looked;
      // Flushed as it goes. A run that dies an hour in must not throw away an
      // hour of Wikimedia's time along with its own.
      if (++since >= FLUSH_EVERY) {
        since = 0;
        save();
      }
      return looked;
    },
    save,
  };
}
