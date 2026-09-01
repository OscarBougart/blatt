/**
 * Chrome's built-in translation, which runs on the machine rather than in
 * somebody's datacentre. No key, no account, no request leaving the laptop.
 *
 * The types are declared here because they are not in TypeScript's DOM library
 * yet. Chrome 138 and later; feature-detected everywhere it is used.
 */

interface DownloadMonitor {
  addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
}

interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (m: DownloadMonitor) => void;
}

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

declare global {
  const Translator: {
    availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
    create(options: TranslatorOptions): Promise<TranslatorInstance>;
  };

  const LanguageDetector: {
    availability(): Promise<Availability>;
    create(options?: { monitor?: (m: DownloadMonitor) => void }): Promise<{
      detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
    }>;
  };
}

export const hasTranslator = (): boolean => 'Translator' in self;
export const hasDetector = (): boolean => 'LanguageDetector' in self;

export async function translatorAvailability(): Promise<Availability> {
  if (!hasTranslator()) return 'unavailable';
  return Translator.availability({ sourceLanguage: 'de', targetLanguage: 'en' });
}

/**
 * Start creating a translator. **Call this synchronously from a click.**
 *
 * Chrome throws `NotAllowedError` if the model still has to be downloaded and
 * there is no user gesture behind the request — and the gesture is spent by
 * the first `await`. Hence a plain function returning a promise rather than an
 * async one: start it as the first statement in the handler, await it later.
 *
 * Without this the extension works on any machine that already has the German
 * pack and fails on every machine that does not.
 */
export function startTranslator(onProgress?: (fraction: number) => void): Promise<TranslatorInstance> {
  return Translator.create({
    sourceLanguage: 'de',
    targetLanguage: 'en',
    monitor(m) {
      m.addEventListener('downloadprogress', (event) => onProgress?.(event.loaded));
    },
  });
}

/** The language Chrome thinks this text is, or null if it cannot say. */
export async function detectLanguage(sample: string): Promise<string | null> {
  if (!hasDetector() || !sample.trim()) return null;
  try {
    const detector = await LanguageDetector.create();
    const [best] = await detector.detect(sample);
    return best?.detectedLanguage ?? null;
  } catch {
    return null;
  }
}

/**
 * Translate paragraphs one at a time, keeping the index.
 *
 * Deliberately not batched: sending several at once is faster, but the model
 * is free to merge or split them, and the paragraph pairing is the product.
 */
export async function translateEach(
  translator: TranslatorInstance,
  paragraphs: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const out: string[] = [];
  for (const paragraph of paragraphs) {
    out.push(await translator.translate(paragraph));
    onProgress?.(out.length, paragraphs.length);
  }
  return out;
}
